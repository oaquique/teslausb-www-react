#!/bin/bash
# Returns current TeslaCam archive progress by parsing rsync output or counting files

# Possible rsync log locations for cam archiving
RSYNC_LOGS=("/tmp/rsyncarclog.txt" "/tmp/rsync-cam.log" "/tmp/archive-rsync.log")

# Default values
active="false"
bytes="0"
percentage="0"
speed=""
eta=""
files_done="0"
files_total="0"
current_file=""

# Check if cam archiving is active (rsync process for TeslaCam)
# Look for rsync processes that involve TeslaCam or cam paths
if pgrep -f "rsync.*TeslaCam" > /dev/null 2>&1 || \
   pgrep -f "rsync.*/mnt/cam" > /dev/null 2>&1 || \
   pgrep -f "rsync.*archive" > /dev/null 2>&1; then
  active="true"

  # Try each possible log file location
  LOG=""
  for log_file in "${RSYNC_LOGS[@]}"; do
    if [ -f "$log_file" ]; then
      LOG="$log_file"
      break
    fi
  done

  # If we found a log file, parse it for progress
  if [ -n "$LOG" ] && [ -f "$LOG" ]; then
    # Get the last progress update from rsync --info=progress2 output
    # rsync uses \r for in-place updates, so the latest progress may not have a trailing newline
    progress_line=$(tail -c 500 "$LOG" 2>/dev/null | tr '\r' '\n' | grep -E '[0-9]+%' | tail -1)

    if [ -n "$progress_line" ]; then
      # Parse using more flexible pattern matching
      # Extract bytes: first number (with possible commas)
      bytes=$(echo "$progress_line" | grep -oE '^[[:space:]]*[0-9,]+' | tr -d ', ')

      # Extract percentage: number followed by %
      percentage=$(echo "$progress_line" | grep -oE '[0-9]+%' | head -1 | tr -d '%')

      # Extract speed: number followed by unit/s (e.g., 1.07MB/s, 500kB/s)
      speed=$(echo "$progress_line" | grep -oE '[0-9.]+[kMGT]?B/s' | head -1)

      # Extract ETA: time format like 0:01:23 or 6:27:37
      eta=$(echo "$progress_line" | grep -oE '[0-9]+:[0-9]+:[0-9]+' | head -1)

      # Ensure we have valid defaults
      [ -z "$bytes" ] && bytes="0"
      [ -z "$percentage" ] && percentage="0"
    fi

    # Try to get file counts from rsync stats (at the end of the log)
    # Format: "Number of regular files transferred: X"
    xfr_line=$(grep -E 'xfr#[0-9]+' "$LOG" 2>/dev/null | tail -1)
    if [ -n "$xfr_line" ]; then
      # Extract xfr#N where N is files transferred so far
      files_done=$(echo "$xfr_line" | grep -oE 'xfr#[0-9]+' | grep -oE '[0-9]+')
      # Try to get total from to-chk=X/Y
      total_from_chk=$(echo "$xfr_line" | grep -oE 'to-chk=[0-9]+/[0-9]+' | cut -d'/' -f2)
      if [ -n "$total_from_chk" ]; then
        files_total="$total_from_chk"
      fi
    fi

    # Try to get current file being transferred
    current_file=$(tail -c 500 "$LOG" 2>/dev/null | tr '\r' '\n' | grep -E '^\S+\.(mp4|MP4)' | tail -1 | head -c 100)
  fi
fi

# If not active via rsync detection, check archiveloop.log for archiving state
if [ "$active" = "false" ]; then
  ARCHIVELOG="/mutable/archiveloop.log"
  if [ -f "$ARCHIVELOG" ]; then
    # Get last 50 lines to check state
    recent=$(tail -50 "$ARCHIVELOG" 2>/dev/null)

    # Check if we're in archiving state (started but not finished)
    if echo "$recent" | grep -q "Starting recording archiving\|Archiving\.\.\.\|Running fsck\|Checking saved folder count"; then
      # Check if archiving has completed
      if ! echo "$recent" | grep -q "Archiving completed successfully\|Finished archiving"; then
        active="true"

        # Try to get file counts from log
        # Format: "There are X event folder(s) with Y file(s) and Z track mode file(s)"
        file_count_line=$(echo "$recent" | grep -E 'There are [0-9]+ event folder' | tail -1)
        if [ -n "$file_count_line" ]; then
          sentry_files=$(echo "$file_count_line" | grep -oE 'with [0-9]+ file' | grep -oE '[0-9]+')
          track_files=$(echo "$file_count_line" | grep -oE 'and [0-9]+ track mode' | grep -oE '[0-9]+')
          [ -z "$track_files" ] && track_files="0"
          files_total=$((sentry_files + track_files))
        fi

        # Alternative format: "Archiving X file(s)"
        if [ "$files_total" = "0" ]; then
          archiving_line=$(echo "$recent" | grep -E 'Archiving [0-9]+ (track mode )?file' | tail -1)
          if [ -n "$archiving_line" ]; then
            files_total=$(echo "$archiving_line" | grep -oE '[0-9]+' | head -1)
          fi
        fi
      fi
    fi
  fi
fi

# Output JSON
echo "HTTP/1.0 200 OK"
echo "Content-type: application/json"
echo ""
echo "{"
echo "  \"active\": $active,"
echo "  \"bytesTransferred\": $bytes,"
echo "  \"percentage\": $percentage,"
echo "  \"speed\": \"$speed\","
echo "  \"eta\": \"$eta\","
echo "  \"filesDone\": $files_done,"
echo "  \"filesTotal\": $files_total,"
echo "  \"currentFile\": \"$current_file\""
echo "}"
