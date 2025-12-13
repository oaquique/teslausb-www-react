#!/bin/bash
# Returns current music sync progress by parsing rsync output

LOG="/tmp/rsyncmusiclog.txt"

# Check if music sync is active (rsync process for music)
if pgrep -f "rsync.*musicarchive" > /dev/null 2>&1; then
  active="true"

  # Get last progress line from rsync --info=progress2 output
  # Format: "    1,234,567,890  45%   12.34MB/s    0:01:23"
  if [ -f "$LOG" ]; then
    # Get the last line matching progress2 format
    progress_line=$(grep -E '^\s+[0-9,]+\s+[0-9]+%' "$LOG" 2>/dev/null | tail -1)

    if [ -n "$progress_line" ]; then
      # Parse the progress line
      # Remove leading whitespace and parse fields
      bytes=$(echo "$progress_line" | awk '{gsub(/,/,"",$1); print $1}')
      percentage=$(echo "$progress_line" | awk '{gsub(/%/,"",$2); print $2}')
      speed=$(echo "$progress_line" | awk '{print $3}')
      eta=$(echo "$progress_line" | awk '{print $4}')
    else
      bytes="0"
      percentage="0"
      speed=""
      eta=""
    fi
  else
    bytes="0"
    percentage="0"
    speed=""
    eta=""
  fi
else
  active="false"
  bytes="0"
  percentage="0"
  speed=""
  eta=""
fi

cat << EOF
HTTP/1.0 200 OK
Content-type: application/json

{
  "active": $active,
  "bytesTransferred": $bytes,
  "percentage": $percentage,
  "speed": "$speed",
  "eta": "$eta"
}
EOF
