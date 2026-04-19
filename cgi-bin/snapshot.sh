#!/bin/bash
# Merged-snapshot endpoint for the TeslaUSB React UI.
#
# Returns a single JSON document containing everything the client used
# to poll from 4+ separate CGI scripts. One request replaces:
#   status.sh + config.sh + storage.sh + music_sync_progress.sh +
#   cam_sync_progress.sh
# With one `snapshot.sh?interval=3000` poll every ~3s the client still
# gets fresh data and the Pi serves 80% fewer CGI invocations.
#
# Why polling instead of SSE: fcgiwrap (the FastCGI gateway on this Pi)
# buffers ~8 KB before flushing to nginx and doesn't support true
# streaming, so Server-Sent Events queue up for minutes before reaching
# the client. A merged one-shot request is the pragmatic win until we
# replace fcgiwrap with a streaming-capable FastCGI daemon.

set -u

readonly CGI_DIR="/var/www/html/cgi-bin"
readonly VERSION_FILE="/var/www/html/VERSION"

# Strip the HTTP status line + CGI headers from an upstream CGI response
# so we're left with just the JSON body. Our existing scripts emit:
#   HTTP/1.0 200 OK
#   Content-type: application/json
#   <blank line>
#   { ... }
# sed '1,/^[[:space:]]*$/d' deletes everything through the first blank.
run_cgi() {
  local path="$1"
  if [[ ! -x "$path" ]]; then
    printf 'null'
    return
  fi
  local out
  out=$("$path" 2>/dev/null) || { printf 'null'; return; }
  printf '%s' "$out" | sed '1,/^[[:space:]]*$/d'
}

status_json=$(run_cgi "$CGI_DIR/status.sh")
config_json=$(run_cgi "$CGI_DIR/config.sh")
storage_json=$(run_cgi "$CGI_DIR/storage.sh")
music_json=$(run_cgi "$CGI_DIR/music_sync_progress.sh")
cam_json=$(run_cgi "$CGI_DIR/cam_sync_progress.sh")

# Deployed UI version — written by deploy.sh at each deploy. Lets the
# running bundle detect version drift vs the freshly-deployed one and
# prompt the user to reload.
if [[ -r "$VERSION_FILE" ]]; then
  version_str=$(tr -d '\n\r"' < "$VERSION_FILE")
  version_json="\"$version_str\""
else
  version_json="null"
fi

cat <<EOF
HTTP/1.0 200 OK
Content-Type: application/json
Cache-Control: no-store

{"version":${version_json},"status":${status_json:-null},"config":${config_json:-null},"storage":${storage_json:-null},"music":${music_json:-null},"cam":${cam_json:-null}}
EOF
