#!/bin/bash
#
# TeslaUSB React UI Deploy Script
#
# This script builds the React UI and deploys it to a Raspberry Pi running TeslaUSB.
# It handles TeslaUSB's read-only filesystem automatically.
#
# Usage:
#   ./deploy.sh [user@host]
#
# Examples:
#   ./deploy.sh                    # Build only (output in ./dist)
#   ./deploy.sh pi@192.168.1.100   # Build and deploy to Pi
#   ./deploy.sh pi@teslausb.local  # Build and deploy using hostname
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

echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║   TeslaUSB React UI Deploy Script     ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo -e "${RED}Error: npm is not installed${NC}"
    exit 1
fi

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}Installing dependencies...${NC}"
    npm install
fi

# Build the project
echo -e "${YELLOW}Building React UI...${NC}"
npm run build

if [ ! -d "dist" ]; then
    echo -e "${RED}Error: Build failed - dist directory not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Build successful${NC}"
echo ""

# Show build size
echo "Build size:"
du -sh dist/
echo ""

# If no remote host specified, just build
if [ -z "$1" ]; then
    echo -e "${YELLOW}No remote host specified. Build complete.${NC}"
    echo ""
    echo "To deploy to your Raspberry Pi, run:"
    echo "  ./deploy.sh pi@<your-pi-ip>"
    echo ""
    echo "Or manually copy the dist/ directory contents to /var/www/html/ on your Pi"
    echo -e "${CYAN}Note: TeslaUSB uses a read-only filesystem. You must run these commands first:${NC}"
    echo "  sudo -i"
    echo "  bin/remountfs_rw"
    exit 0
fi

REMOTE_HOST="$1"

echo -e "${YELLOW}Deploying to ${REMOTE_HOST}...${NC}"
echo ""

# Test SSH connection
echo -e "${YELLOW}Testing SSH connection...${NC}"
if ! ssh -o ConnectTimeout=5 "$REMOTE_HOST" "echo 'SSH connection successful'" 2>/dev/null; then
    echo -e "${RED}Error: Cannot connect to ${REMOTE_HOST}${NC}"
    echo "Make sure:"
    echo "  1. The Raspberry Pi is powered on and connected to the network"
    echo "  2. SSH is enabled on the Pi"
    echo "  3. You can SSH to the Pi manually: ssh ${REMOTE_HOST}"
    exit 1
fi

# Upload files to temp directory first (this works on read-only fs)
echo -e "${YELLOW}Uploading new UI files to temp directory...${NC}"

# Create temp directory and upload
ssh -T "$REMOTE_HOST" "rm -rf /tmp/teslausb-www-new && mkdir -p /tmp/teslausb-www-new"

# Use rsync if available, otherwise fall back to scp
if command -v rsync &> /dev/null; then
    rsync -avz --delete \
        dist/ "${REMOTE_HOST}:/tmp/teslausb-www-new/"
else
    scp -r dist/* "${REMOTE_HOST}:/tmp/teslausb-www-new/"
fi

# Upload local cgi-bin scripts (new scripts we've added)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LOCAL_CGI="$SCRIPT_DIR/cgi-bin"
if [ -d "$LOCAL_CGI" ]; then
    echo -e "${YELLOW}Uploading local cgi-bin scripts...${NC}"
    ssh "$REMOTE_HOST" "mkdir -p /tmp/teslausb-cgi-local"
    rsync -avz "$LOCAL_CGI/" "${REMOTE_HOST}:/tmp/teslausb-cgi-local/" 2>/dev/null || \
        scp -r "$LOCAL_CGI"/* "${REMOTE_HOST}:/tmp/teslausb-cgi-local/"
fi

# Upload backend scripts (copy-music.sh, etc.) from local backend-scripts directory
BACKEND_SCRIPTS="$SCRIPT_DIR/backend-scripts"
if [ -d "$BACKEND_SCRIPTS" ]; then
    echo -e "${YELLOW}Uploading backend scripts...${NC}"
    ssh "$REMOTE_HOST" "mkdir -p /tmp/teslausb-backend"
    rsync -avz "$BACKEND_SCRIPTS/" "${REMOTE_HOST}:/tmp/teslausb-backend/" 2>/dev/null || \
        scp -r "$BACKEND_SCRIPTS"/* "${REMOTE_HOST}:/tmp/teslausb-backend/"
fi

# Also upload cgi-bin from the teslausb-www source as fallback
CGI_SRC="$SCRIPT_DIR/../teslausb-www/html/cgi-bin"
if [ -d "$CGI_SRC" ]; then
    echo -e "${YELLOW}Uploading cgi-bin scripts as fallback...${NC}"
    ssh "$REMOTE_HOST" "mkdir -p /tmp/teslausb-cgi-bin"
    rsync -avz "$CGI_SRC/" "${REMOTE_HOST}:/tmp/teslausb-cgi-bin/" 2>/dev/null || \
        scp -r "$CGI_SRC"/* "${REMOTE_HOST}:/tmp/teslausb-cgi-bin/"
fi

echo -e "${GREEN}✓ Files uploaded${NC}"
echo ""

# Deploy to final location (requires remounting filesystem as read-write)
echo -e "${YELLOW}Deploying to ${REMOTE_PATH}...${NC}"
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
    REMOUNTED=true
else
    echo "Filesystem is already read-write"
    REMOUNTED=false
fi

# Create staging directory
sudo rm -rf /tmp/teslausb-www-deploy
sudo mkdir -p /tmp/teslausb-www-deploy

# Copy new UI files
sudo cp -r /tmp/teslausb-www-new/* /tmp/teslausb-www-deploy/

# Preserve existing backend files or use fallback from repo
if [ -d "/var/www/html/cgi-bin" ]; then
    echo "Preserving cgi-bin..."
    sudo cp -r /var/www/html/cgi-bin /tmp/teslausb-www-deploy/
elif [ -d "/tmp/teslausb-cgi-bin" ]; then
    echo "Installing cgi-bin from source..."
    sudo cp -r /tmp/teslausb-cgi-bin /tmp/teslausb-www-deploy/cgi-bin
fi

# Merge in local cgi-bin scripts (overwrite/add new scripts)
if [ -d "/tmp/teslausb-cgi-local" ]; then
    echo "Installing local cgi-bin scripts..."
    sudo mkdir -p /tmp/teslausb-www-deploy/cgi-bin
    sudo cp -r /tmp/teslausb-cgi-local/* /tmp/teslausb-www-deploy/cgi-bin/
    sudo chmod +x /tmp/teslausb-www-deploy/cgi-bin/*.sh
fi

# Install backend scripts to /root/bin/
if [ -d "/tmp/teslausb-backend" ]; then
    echo "Installing backend scripts to /root/bin/..."
    for script in /tmp/teslausb-backend/*.sh; do
        if [ -f "$script" ]; then
            name=$(basename "$script")
            # Backup existing script if it exists
            if [ -f "/root/bin/$name" ]; then
                sudo cp "/root/bin/$name" "/root/bin/${name}.bak"
            fi
            sudo cp "$script" "/root/bin/$name"
            sudo chmod +x "/root/bin/$name"
            echo "  Installed $name"
        fi
    done
fi

# Preserve fancyindex CSS for TeslaCam directory listing
if [ -f "/var/www/html/fancyindex.css" ]; then
    echo "Preserving fancyindex.css..."
    sudo cp /var/www/html/fancyindex.css /tmp/teslausb-www-deploy/
fi

# Preserve contextmenu files
if [ -f "/var/www/html/contextmenu.js" ]; then
    sudo cp /var/www/html/contextmenu.js /tmp/teslausb-www-deploy/
fi
if [ -f "/var/www/html/contextmenu.css" ]; then
    sudo cp /var/www/html/contextmenu.css /tmp/teslausb-www-deploy/
fi

# Preserve filebrowser files only if new ones don't exist
if [ -f "/var/www/html/filebrowser.js" ] && [ ! -f "/tmp/teslausb-www-deploy/filebrowser.js" ]; then
    echo "Preserving filebrowser.js..."
    sudo cp /var/www/html/filebrowser.js /tmp/teslausb-www-deploy/
fi
if [ -f "/var/www/html/filebrowser.css" ] && [ ! -f "/tmp/teslausb-www-deploy/filebrowser.css" ]; then
    echo "Preserving filebrowser.css..."
    sudo cp /var/www/html/filebrowser.css /tmp/teslausb-www-deploy/
fi

# Preserve icons if they exist and new ones don't
if [ -d "/var/www/html/icons" ] && [ ! -d "/tmp/teslausb-www-deploy/icons" ]; then
    echo "Preserving icons..."
    sudo cp -r /var/www/html/icons /tmp/teslausb-www-deploy/
fi

# Preserve favicon if it exists and new one doesn't
if [ -f "/var/www/html/favicon.ico" ] && [ ! -f "/tmp/teslausb-www-deploy/favicon.ico" ]; then
    sudo cp /var/www/html/favicon.ico /tmp/teslausb-www-deploy/
fi

# Deploy to final location using rsync to avoid symlink issues
# (TeslaCam, Music, etc. are symlinks to mounted filesystems)
echo "Deploying new UI..."

# Create backup of current UI (excluding symlinks to mounted filesystems)
if [ -d "/var/www/html" ]; then
    echo "Creating backup of current UI..."
    sudo rm -rf /var/www/html.backup 2>/dev/null || true
    sudo mkdir -p /var/www/html.backup
    # Copy only non-symlink items
    for item in /var/www/html/*; do
        if [ ! -L "$item" ]; then
            sudo cp -r "$item" /var/www/html.backup/ 2>/dev/null || true
        fi
    done
    # Mark this as a valid backup with timestamp
    date > /tmp/backup_marker && sudo mv /tmp/backup_marker /var/www/html.backup/.backup_marker
    echo "Backup created at /var/www/html.backup"
fi

# Copy only regular files, not symlinks, to avoid issues with mounted filesystems
for item in /tmp/teslausb-www-deploy/*; do
    name=$(basename "$item")
    # Remove old version (only if it's a regular file/dir, not a symlink)
    if [ ! -L "/var/www/html/$name" ]; then
        sudo rm -rf "/var/www/html/$name" 2>/dev/null || true
    fi
    # Copy new version
    sudo cp -r "$item" "/var/www/html/"
done

# Set permissions (skip symlinks to avoid errors on FAT/other filesystems)
sudo find /var/www/html -not -type l -exec chown www-data:www-data {} + 2>/dev/null || true
sudo find /var/www/html -not -type l -exec chmod 755 {} + 2>/dev/null || true

# Create symlinks for log files and diagnostics
echo "Creating log symlinks..."
sudo ln -sf /mutable/archiveloop.log /var/www/html/archiveloop.log
sudo ln -sf /boot/firmware/teslausb-headless-setup.log /var/www/html/teslausb-headless-setup.log
sudo ln -sf /tmp/diagnostics.txt /var/www/html/diagnostics.txt

# Create fs directory with symlinks to mounted drives
echo "Creating drive symlinks..."
sudo mkdir -p /var/www/html/fs
sudo ln -sf /mnt/music /var/www/html/fs/Music
sudo ln -sf /mnt/lightshow /var/www/html/fs/LightShow
sudo ln -sf /mnt/boombox /var/www/html/fs/Boombox

# Create TeslaCam symlink for video viewer
echo "Creating TeslaCam symlink..."
if [ -d "/var/www/html.old/TeslaCam" ]; then
    sudo ln -sf /var/www/html.old/TeslaCam /var/www/html/TeslaCam
elif [ -d "/mnt/cam/TeslaCam" ]; then
    sudo ln -sf /mnt/cam/TeslaCam /var/www/html/TeslaCam
fi

# Cleanup temp files
sudo rm -rf /tmp/teslausb-www-new
sudo rm -rf /tmp/teslausb-cgi-bin 2>/dev/null || true
sudo rm -rf /tmp/teslausb-cgi-local 2>/dev/null || true
sudo rm -rf /tmp/teslausb-www-deploy 2>/dev/null || true
sudo rm -rf /tmp/teslausb-backend 2>/dev/null || true

echo ""
echo "Deployment complete!"

# Note: We don't remount as read-only here - TeslaUSB will do that on next boot
# or you can manually run: mount -o remount,ro /
ENDSSH

echo ""
echo -e "${GREEN}╔═══════════════════════════════════════╗${NC}"
echo -e "${GREEN}║         Deployment Complete!          ║${NC}"
echo -e "${GREEN}╚═══════════════════════════════════════╝${NC}"
echo ""
echo "Your new TeslaUSB UI is now live at:"
echo -e "  ${GREEN}http://${REMOTE_HOST#*@}/${NC}"
echo ""
echo -e "${CYAN}Note: The filesystem is currently read-write.${NC}"
echo "It will return to read-only on next reboot, or you can run:"
echo "  ssh ${REMOTE_HOST} 'sudo mount -o remount,ro /'"
echo ""
echo "To rollback to the previous UI version, run:"
echo -e "  ${YELLOW}./rollback.sh ${REMOTE_HOST}${NC}"
echo ""
