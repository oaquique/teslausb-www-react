#!/bin/bash
#
# TeslaUSB React UI Rollback Script
#
# This script restores the previous web UI from backup on a Raspberry Pi running TeslaUSB.
# A backup is automatically created each time deploy.sh runs.
#
# Usage:
#   ./rollback.sh <user@host>
#
# Examples:
#   ./rollback.sh pi@192.168.1.100   # Rollback on Pi at this IP
#   ./rollback.sh pi@teslausb.local  # Rollback using hostname
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
REMOTE_PATH="/var/www/html"
BACKUP_PATH="/var/www/html.backup"

echo -e "${YELLOW}╔═══════════════════════════════════════╗${NC}"
echo -e "${YELLOW}║   TeslaUSB React UI Rollback Script   ║${NC}"
echo -e "${YELLOW}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if remote host is specified
if [ -z "$1" ]; then
    echo -e "${RED}Error: No remote host specified${NC}"
    echo ""
    echo "Usage: ./rollback.sh <user@host>"
    echo ""
    echo "Examples:"
    echo "  ./rollback.sh pi@192.168.1.100"
    echo "  ./rollback.sh pi@teslausb.local"
    exit 1
fi

REMOTE_HOST="$1"

echo -e "${YELLOW}Connecting to ${REMOTE_HOST}...${NC}"
echo ""

# Test SSH connection
if ! ssh -o ConnectTimeout=5 "$REMOTE_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${RED}Error: Cannot connect to ${REMOTE_HOST}${NC}"
    echo "Make sure:"
    echo "  1. The Raspberry Pi is powered on and connected to the network"
    echo "  2. SSH is enabled on the Pi"
    echo "  3. You can SSH to the Pi manually: ssh ${REMOTE_HOST}"
    exit 1
fi

# Check if backup exists
echo -e "${YELLOW}Checking for backup...${NC}"
BACKUP_EXISTS=$(ssh -T "$REMOTE_HOST" "[ -f ${BACKUP_PATH}/.backup_marker ] && echo 'yes' || echo 'no'")

if [ "$BACKUP_EXISTS" != "yes" ]; then
    echo -e "${RED}Error: No backup found at ${BACKUP_PATH}${NC}"
    echo ""
    echo "A backup is created automatically when you run deploy.sh."
    echo "If you haven't deployed yet, there's nothing to rollback to."
    exit 1
fi

# Show backup info
echo -e "${GREEN}Backup found!${NC}"
BACKUP_DATE=$(ssh -T "$REMOTE_HOST" "cat ${BACKUP_PATH}/.backup_marker 2>/dev/null || echo 'unknown'")
echo "Backup created: $BACKUP_DATE"
echo ""

# Confirm rollback
echo -e "${YELLOW}This will restore the previous UI version and replace the current one.${NC}"
read -p "Continue with rollback? [y/N] " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Rollback cancelled."
    exit 0
fi

echo ""
echo -e "${YELLOW}Restoring from backup...${NC}"
echo -e "${CYAN}(Remounting filesystem as read-write)${NC}"

ssh -T "$REMOTE_HOST" << 'ENDSSH'
set -e

# Function to check if filesystem is read-only
is_readonly() {
    mount | grep ' / ' | grep -q 'ro,'
}

# Remount filesystem as read-write if needed
if is_readonly; then
    echo "Filesystem is read-only, remounting as read-write..."
    sudo /root/bin/remountfs_rw
else
    echo "Filesystem is already read-write"
fi

BACKUP_PATH="/var/www/html.backup"
TARGET_PATH="/var/www/html"

# Remove current UI files (but not symlinks)
echo "Removing current UI files..."
for item in $TARGET_PATH/*; do
    if [ ! -L "$item" ]; then
        sudo rm -rf "$item" 2>/dev/null || true
    fi
done

# Restore from backup
echo "Restoring from backup..."
for item in $BACKUP_PATH/*; do
    name=$(basename "$item")
    # Skip the backup marker file
    if [ "$name" = ".backup_marker" ]; then
        continue
    fi
    sudo cp -r "$item" "$TARGET_PATH/"
done

# Set permissions (skip symlinks to avoid errors on FAT/other filesystems)
sudo find $TARGET_PATH -not -type l -exec chown www-data:www-data {} + 2>/dev/null || true
sudo find $TARGET_PATH -not -type l -exec chmod 755 {} + 2>/dev/null || true

# Recreate symlinks for log files and diagnostics
echo "Recreating symlinks..."
sudo ln -sf /mutable/archiveloop.log $TARGET_PATH/archiveloop.log
sudo ln -sf /boot/firmware/teslausb-headless-setup.log $TARGET_PATH/teslausb-headless-setup.log
sudo ln -sf /tmp/diagnostics.txt $TARGET_PATH/diagnostics.txt

# Recreate fs directory with symlinks to mounted drives
sudo mkdir -p $TARGET_PATH/fs
sudo ln -sf /mnt/music $TARGET_PATH/fs/Music
sudo ln -sf /mnt/lightshow $TARGET_PATH/fs/LightShow
sudo ln -sf /mnt/boombox $TARGET_PATH/fs/Boombox

# Recreate TeslaCam symlink
if [ -d "/var/www/html.old/TeslaCam" ]; then
    sudo ln -sf /var/www/html.old/TeslaCam $TARGET_PATH/TeslaCam
elif [ -d "/mnt/cam/TeslaCam" ]; then
    sudo ln -sf /mnt/cam/TeslaCam $TARGET_PATH/TeslaCam
fi

echo ""
echo "Rollback complete!"
ENDSSH

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Rollback Complete!            ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo "The previous UI version has been restored."
echo -e "View it at: ${GREEN}http://${REMOTE_HOST#*@}/${NC}"
echo ""
echo -e "${CYAN}Note: The filesystem is currently read-write.${NC}"
echo "It will return to read-only on next reboot, or you can run:"
echo "  ssh ${REMOTE_HOST} 'sudo mount -o remount,ro /'"
echo ""
