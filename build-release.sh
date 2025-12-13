#!/bin/bash
#
# Build release tarball for TeslaUSB integration
#
# This creates teslausb-react-ui.tgz which can be extracted to /var/www/html/
# to install the React UI at /var/www/html/react/
#

set -ex

BASEDIR=$(dirname "$0")
cd "$BASEDIR"

# Build the project with /react/ base path
VITE_BASE_PATH=/react/ npm run build

# Clean up any previous release artifacts
rm -rf react
rm -f teslausb-react-ui.tgz

# Rename dist to react (will be served at /react/ path)
mv dist react

# Include cgi-bin scripts specific to this UI
mkdir -p react/cgi-bin
cp cgi-bin/*.sh react/cgi-bin/

# Create tarball excluding source maps
tar --exclude='*.map' -czvf teslausb-react-ui.tgz react

# Clean up
rm -rf react

echo ""
echo "Created: teslausb-react-ui.tgz"
echo ""
echo "To install on TeslaUSB:"
echo "  1. Copy to Pi: scp teslausb-react-ui.tgz pi@<ip>:/tmp/"
echo "  2. SSH to Pi and run:"
echo "     sudo /root/bin/remountfs_rw"
echo "     sudo tar -C /var/www/html -xf /tmp/teslausb-react-ui.tgz"
echo "  3. Access at: http://<pi-ip>/react/"
