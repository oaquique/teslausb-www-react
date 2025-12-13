#!/bin/bash
# Returns current music sync progress by parsing rsync output

LOG="/tmp/rsyncmusiclog.txt"

# Default values
active="false"
bytes="0"
percentage="0"
speed=""
eta=""

# Check if music sync is active (rsync process for music)
if pgrep -f "rsync.*music" > /dev/null 2>&1; then
  active="true"

  # Get last progress line from rsync --info=progress2 output
  # Format: "    1,234,567,890  45%   12.34MB/s    0:01:23"
  # Or:     "1695349328   6%    1.07MB/s    6:27:37"
  if [ -f "$LOG" ]; then
    # Get the last progress update from rsync --info=progress2 output
    # rsync uses \r for in-place updates, so the latest progress may not have a trailing newline
    # Use tail -c to get the last chunk, then extract the most recent progress line
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
echo "  \"eta\": \"$eta\""
echo "}"
