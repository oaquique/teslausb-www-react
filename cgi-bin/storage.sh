#!/bin/bash

cat << EOF
HTTP/1.0 200 OK
Content-type: application/json

EOF

# Cache directory for storing last known usage when drives were mounted
CACHE_DIR="/tmp/teslausb-storage-cache"
mkdir -p "$CACHE_DIR" 2>/dev/null

echo "{"

first=true

# Function to output drive info
output_drive() {
    local name=$1
    local mount_point=$2
    local backing_file=$3
    local cache_file="$CACHE_DIR/${name}_usage"

    if [ "$first" = false ]; then
        echo ","
    fi
    first=false

    # Check if mount point has actual filesystem mounted (not just the root fs)
    mount_info=$(df "$mount_point" 2>/dev/null | tail -1)
    mount_device=$(echo "$mount_info" | awk '{print $1}')

    # Check if it's mounted from a backing file or loop device (not root filesystem)
    if echo "$mount_device" | grep -qE "(backingfiles|loop)"; then
        drive_info=$(df -B1 "$mount_point" 2>/dev/null | tail -1)
        if [ -n "$drive_info" ]; then
            total=$(echo "$drive_info" | awk '{print $2}')
            used=$(echo "$drive_info" | awk '{print $3}')
            free=$(echo "$drive_info" | awk '{print $4}')
            # Cache the current values for when drive is unmounted
            echo "$used $total $free" > "$cache_file"
            echo -n "  \"$name\": { \"total\": $total, \"used\": $used, \"free\": $free, \"mounted\": true }"
            return
        fi
    fi

    # Fall back to backing file size if exists
    if [ -f "$backing_file" ]; then
        total=$(stat -c%s "$backing_file" 2>/dev/null)
        if [ -n "$total" ]; then
            # Check if we have cached usage data from when it was last mounted
            if [ -f "$cache_file" ]; then
                read cached_used cached_total cached_free < "$cache_file"
                # Use cached values if total matches (same drive)
                if [ "$cached_total" = "$total" ] || [ -n "$cached_used" ]; then
                    echo -n "  \"$name\": { \"total\": $total, \"used\": $cached_used, \"free\": $cached_free, \"mounted\": false, \"cached\": true }"
                    return
                fi
            fi
            # No cache available, report allocation only
            echo -n "  \"$name\": { \"total\": $total, \"used\": null, \"free\": null, \"mounted\": false }"
            return
        fi
    fi

    # Drive not configured
    echo -n "  \"$name\": null"
}

# TeslaCam drive
output_drive "cam" "/mnt/cam" "/backingfiles/cam_disk.bin"

# Music drive
output_drive "music" "/mnt/music" "/backingfiles/music_disk.bin"

# LightShow drive
output_drive "lightshow" "/mnt/lightshow" "/backingfiles/lightshow_disk.bin"

# Boombox drive
output_drive "boombox" "/mnt/boombox" "/backingfiles/boombox_disk.bin"

# Overall backingfiles partition (total storage)
echo ","
bf_info=$(df -B1 /backingfiles 2>/dev/null | tail -1)
if [ -n "$bf_info" ]; then
    bf_total=$(echo "$bf_info" | awk '{print $2}')
    bf_used=$(echo "$bf_info" | awk '{print $3}')
    bf_free=$(echo "$bf_info" | awk '{print $4}')
    echo "  \"total\": { \"total\": $bf_total, \"used\": $bf_used, \"free\": $bf_free }"
else
    echo "  \"total\": null"
fi

echo "}"
