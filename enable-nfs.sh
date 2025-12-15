#!/bin/bash -eu
#
# enable-nfs.sh - Add NFS archiving support to an existing TeslaUSB installation
#
# Usage:
#   1. Copy this script to your TeslaUSB Pi
#   2. Make sure your teslausb_setup_variables.conf has:
#        export ARCHIVE_SYSTEM=nfs
#        export ARCHIVE_SERVER=your_nas_ip
#        export SHARE_NAME='/path/to/TeslaCam'
#        export MUSIC_SHARE_NAME='/path/to/Music'  # optional
#   3. Run: sudo bash enable-nfs.sh
#

SCRIPT_DIR="/root/bin"
NFS_DIR="$SCRIPT_DIR"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log() {
    echo -e "${GREEN}[NFS-SETUP]${NC} $1"
}

warn() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

error() {
    echo -e "${RED}[ERROR]${NC} $1"
    exit 1
}

# Check if running as root
if [ "$EUID" -ne 0 ]; then
    error "Please run as root (sudo bash enable-nfs.sh)"
fi

# Source the config file
if [ -f /root/teslausb_setup_variables.conf ]; then
    source /root/teslausb_setup_variables.conf
elif [ -f /boot/teslausb_setup_variables.conf ]; then
    source /boot/teslausb_setup_variables.conf
else
    error "Could not find teslausb_setup_variables.conf"
fi

# Verify NFS config
if [ "${ARCHIVE_SYSTEM:-}" != "nfs" ]; then
    error "ARCHIVE_SYSTEM is not set to 'nfs' in your config file"
fi

if [ -z "${ARCHIVE_SERVER:-}" ]; then
    error "ARCHIVE_SERVER is not set in your config file"
fi

if [ -z "${SHARE_NAME:-}" ]; then
    error "SHARE_NAME is not set in your config file"
fi

log "Installing required packages..."
apt-get update
apt-get -y install nfs-common hping3
if ! command -v nc > /dev/null; then
    apt-get -y install netcat-openbsd || apt-get -y install netcat
fi

log "Creating NFS archive scripts..."

# archive-is-reachable.sh
cat > "$NFS_DIR/archive-is-reachable.sh" << 'SCRIPT'
#!/bin/bash -eu

ARCHIVE_HOST_NAME="$1"
nc -z -w 5 "$ARCHIVE_HOST_NAME" 2049 > /dev/null 2>&1
SCRIPT
chmod +x "$NFS_DIR/archive-is-reachable.sh"

# connect-archive.sh
cat > "$NFS_DIR/connect-archive.sh" << 'SCRIPT'
#!/bin/bash -eu

function mount_if_set() {
  local mount_point=$1
  [ -z "$mount_point" ] || ensure_mountpoint_is_mounted_with_retry "$mount_point"
}

mount_if_set "${ARCHIVE_MOUNT:-}"
mount_if_set "${MUSIC_ARCHIVE_MOUNT:-}"
SCRIPT
chmod +x "$NFS_DIR/connect-archive.sh"

# disconnect-archive.sh
cat > "$NFS_DIR/disconnect-archive.sh" << 'SCRIPT'
#!/bin/bash -eu

unmount_if_set() {
  local mount_point=$1
  if [ -n "$mount_point" ]
  then
    if findmnt --mountpoint "$mount_point" > /dev/null
    then
      if timeout 10 umount -f -l "$mount_point" >> "$LOG_FILE" 2>&1
      then
        log "Unmounted $mount_point."
      else
        log "Failed to unmount $mount_point."
      fi
    else
      log "$mount_point already unmounted."
    fi
  fi
}

unmount_if_set "${ARCHIVE_MOUNT:-}" &
unmount_if_set "${MUSIC_ARCHIVE_MOUNT:-}" &
SCRIPT
chmod +x "$NFS_DIR/disconnect-archive.sh"

# archive-clips.sh
cat > "$NFS_DIR/archive-clips.sh" << 'SCRIPT'
#!/bin/bash -eu

function connectionmonitor {
  while true
  do
    for _ in {1..5}
    do
      if timeout 6 /root/bin/archive-is-reachable.sh "$ARCHIVE_SERVER"
      then
        sleep 5
        continue 2
      fi
      sleep 1
    done
    log "connection dead, killing archive-clips"
    killall rsync || true
    sleep 2
    killall -9 rsync || true
    kill -9 "$1" || true
    return
  done
}

connectionmonitor $$ &

rsynctmp=".teslausbtmp"
rm -rf "$ARCHIVE_MOUNT/${rsynctmp:?}" || true
mkdir -p "$ARCHIVE_MOUNT/$rsynctmp"

rm -f /tmp/archive-rsync-cmd.log /tmp/archive-error.log

while [ -n "${1+x}" ]
do
  # Using --no-o --no-g to prevent permission errors on NFS root squashed shares
  if ! (rsync -avhRL --no-o --no-g --remove-source-files --temp-dir="$rsynctmp" --no-perms --omit-dir-times --stats \
        --log-file=/tmp/archive-rsync-cmd.log --ignore-missing-args \
        --files-from="$2" "$1/" "$ARCHIVE_MOUNT" &> /tmp/rsynclog || [[ "$?" = "24" ]] )
  then
    cat /tmp/archive-rsync-cmd.log /tmp/rsynclog > /tmp/archive-error.log
    exit 1
  fi
  shift 2
done

rm -rf "$ARCHIVE_MOUNT/${rsynctmp:?}" || true
kill %1 || true
SCRIPT
chmod +x "$NFS_DIR/archive-clips.sh"

# copy-music.sh (NFS version)
cat > "$NFS_DIR/copy-music-nfs.sh" << 'SCRIPT'
#!/bin/bash -eu

ensure_music_file_is_mounted
/root/bin/copy-music.sh
trim_free_space "$MUSIC_MOUNT"
unmount_music_file
SCRIPT
chmod +x "$NFS_DIR/copy-music-nfs.sh"

log "Patching archiveloop for NFS support..."

# Patch archiveloop to recognize NFS
ARCHIVELOOP="/root/bin/archiveloop"
if [ -f "$ARCHIVELOOP" ]; then
    # Check if already patched
    if grep -q 'ARCHIVE_SYSTEM:-none}" = "nfs"' "$ARCHIVELOOP"; then
        log "archiveloop already patched for NFS"
    else
        # Patch the CIFS check to include NFS
        sed -i 's/\[ "\${ARCHIVE_SYSTEM:-none}" = "cifs" \]/[ "${ARCHIVE_SYSTEM:-none}" = "cifs" ] || [ "${ARCHIVE_SYSTEM:-none}" = "nfs" ]/g' "$ARCHIVELOOP"
        sed -i 's/# For CIFS/# For CIFS and NFS/g' "$ARCHIVELOOP"
        log "archiveloop patched successfully"
    fi
else
    warn "archiveloop not found at $ARCHIVELOOP"
fi

log "Configuring NFS mounts in fstab..."

# Create mount points
ARCHIVE_PATH="/mnt/archive"
MUSIC_ARCHIVE_PATH="/mnt/musicarchive"

if [ ! -d "$ARCHIVE_PATH" ]; then
    mkdir -p "$ARCHIVE_PATH"
    log "Created $ARCHIVE_PATH"
fi

# Remove existing NFS entries to prevent duplicates
sed -i '/^.* nfs .*$/d' /etc/fstab

# Add NFS mount for TeslaCam archive
if [ -e /backingfiles/cam_disk.bin ]; then
    echo "$ARCHIVE_SERVER:$SHARE_NAME $ARCHIVE_PATH nfs rw,noauto,nolock,proto=tcp,vers=3 0 0" >> /etc/fstab
    log "Added TeslaCam NFS mount to fstab"
fi

# Add NFS mount for Music archive (if configured)
if [ -n "${MUSIC_SHARE_NAME:-}" ]; then
    if [ ! -d "$MUSIC_ARCHIVE_PATH" ]; then
        mkdir -p "$MUSIC_ARCHIVE_PATH"
        log "Created $MUSIC_ARCHIVE_PATH"
    fi
    echo "$ARCHIVE_SERVER:$MUSIC_SHARE_NAME $MUSIC_ARCHIVE_PATH nfs ro,noauto,nolock,proto=tcp,vers=3 0 0" >> /etc/fstab
    log "Added Music NFS mount to fstab"
fi

log "Testing NFS connectivity..."

# Test if NFS server is reachable
if nc -z -w 5 "$ARCHIVE_SERVER" 2049; then
    log "NFS server $ARCHIVE_SERVER is reachable on port 2049"
else
    warn "Cannot reach NFS server $ARCHIVE_SERVER on port 2049 - check your network/firewall"
fi

# Test mount
log "Testing NFS mount..."
if mount "$ARCHIVE_PATH" 2>/dev/null; then
    log "NFS mount successful!"

    # Test write permission
    if touch "$ARCHIVE_PATH/.teslausb-test" 2>/dev/null; then
        rm "$ARCHIVE_PATH/.teslausb-test"
        log "Write permission confirmed"
    else
        warn "Cannot write to NFS share - check NFS export permissions"
    fi

    umount "$ARCHIVE_PATH"
else
    warn "Could not mount NFS share - will retry during normal operation"
fi

# Test music mount if configured
if [ -n "${MUSIC_SHARE_NAME:-}" ]; then
    log "Testing Music NFS mount..."
    if mount "$MUSIC_ARCHIVE_PATH" 2>/dev/null; then
        log "Music NFS mount successful!"
        umount "$MUSIC_ARCHIVE_PATH"
    else
        warn "Could not mount Music NFS share"
    fi
fi

log ""
log "=========================================="
log "NFS support has been enabled!"
log "=========================================="
log ""
log "Configuration:"
log "  Archive Server: $ARCHIVE_SERVER"
log "  TeslaCam Share: $SHARE_NAME"
if [ -n "${MUSIC_SHARE_NAME:-}" ]; then
    log "  Music Share:    $MUSIC_SHARE_NAME"
fi
log ""
log "The system will use NFS for archiving on next sync."
log "You can reboot now or wait for the next archive cycle."
log ""
