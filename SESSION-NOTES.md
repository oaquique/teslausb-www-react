# TeslaUSB React Web UI - Session Notes

## 2024-12-09 - Initial Development

### Created
- **Complete React-based web UI** replacing the original TeslaUSB web interface
- Built with **Preact + Vite** for minimal bundle size (~56KB JS, ~25KB CSS gzipped)

### Components

#### Dashboard (`src/components/Dashboard.jsx`)
- System status display (USB connection, WiFi, temperature)
- Storage usage with per-drive breakdown showing allocation and usage percentages
- Sync status with real-time updates from archive log

#### File Browser (`src/components/FileBrowser.jsx`)
- Wrapper component that loads native `filebrowser.js` dynamically
- Supports Music, LightShow, and Boombox drives
- Two-pane tree view layout (from original UI)

#### Video Viewer (`src/components/VideoViewer.jsx`)
- Multi-camera synchronized playback for TeslaCam recordings
- Layout options: All Cameras, Front Focus, Rear Focus, Side View, single camera
- Category selection: Sentry Clips, Saved Clips, Recent Clips
- Playback controls with timeline scrubbing

#### Log Viewer (`src/components/LogViewer.jsx`)
- Archive Log (archiveloop.log) - sync and archive operations
- Setup Log (teslausb-headless-setup.log) - initial setup
- Diagnostics - system diagnostics report with regenerate option
- Syntax highlighting for errors, warnings, success messages

#### Other Components
- `Header.jsx` - Navigation tabs and refresh button
- `Sidebar.jsx` - Quick status overview (desktop)
- `StorageBar.jsx` - Visual storage allocation display
- `SyncStatus.jsx` - Sync state indicator
- `LoadingScreen.jsx` - Initial loading state
- `Icons.jsx` - SVG icon components

### Hooks
- `useStatus.js` - Polls status/config/storage APIs with auto-refresh
- `useLogTail.js` - Tails log files with sync status parsing

### Services
- `api.js` - API client for all CGI endpoints

### Styling
- `src/styles/index.css` - Main stylesheet with responsive design
- `src/styles/fonts.css` - Lato font definitions
- `public/filebrowser.css` - Adapted file browser styles (Lato font, #0095f6 blue accent)

### Public Assets
- `filebrowser.js` - Native file browser (with `window.FileBrowser` export added)
- `icons/` - Favicon set and file browser action icons

### Deployment
- `deploy.sh` - Build and deploy script for Raspberry Pi
  - Handles TeslaUSB's read-only filesystem
  - Creates symlinks for logs, drives, and TeslaCam
  - Preserves cgi-bin scripts from existing installation

### Fixes Applied During Development
1. **Storage display** - Changed from allocation percentage to usage percentage within each drive
2. **Music sync detection** - Added separate check for active music sync before main state detection
3. **Setup log** - Fixed symlink to point to `/boot/firmware/teslausb-headless-setup.log`
4. **Diagnostics** - Created symlink from `/var/www/html/diagnostics.txt` to `/tmp/diagnostics.txt`
5. **File browser** - Integrated native filebrowser.js with adapted CSS styling
6. **FileBrowser flashing** - Fixed by using stable dependency values instead of config object reference
7. **window.FileBrowser undefined** - Added `window.FileBrowser = FileBrowser;` export to filebrowser.js
8. **Header spacing** - Added margin between "Updated" text and Refresh button
9. **TeslaCam videos** - Created symlink for `/var/www/html/TeslaCam`

### Repository
- Created as standalone repo (separate from main teslausb repo)
- GitHub: https://github.com/oaquique/teslausb-www-react (private)

## 2025-12-09 - Storage Bar Fix & Device Model Display

### Added CGI Scripts (`cgi-bin/`)
- **`storage.sh`** - Returns per-drive storage information as JSON
  - Reports TeslaCam, Music, LightShow, and Boombox drive allocations
  - Shows actual usage when drives are mounted
  - Caches usage data in `/tmp/teslausb-storage-cache/` for when drives are unmounted
  - Displays cached values with `~` indicator (e.g., "45.4 GB used~")
- **`status.sh`** - Updated to include `device_model` field
  - Reads from `/proc/device-tree/model` (works on RPi, Radxa, etc.)

### Updated Components
- **`Sidebar.jsx`** - Added device model display at top of System card
  - Shows full model name (e.g., "Raspberry Pi 5 Model B Rev 1.0")

### Updated Deployment
- **`deploy.sh`** - Now includes local `cgi-bin/` scripts in deployment
  - Uploads scripts from `cgi-bin/` directory to Pi
  - Merges with existing cgi-bin (preserves Pi's scripts, adds/overwrites new ones)
  - Sets executable permissions on all `.sh` files

### Added Assets
- **`public/fonts/`** - Added Lato font files (were missing)
  - `lato-regular.woff2`
  - `lato-bold.woff2`
  - `lato-italic.woff2`

### Fixes
1. **Storage bar empty** - Created `storage.sh` CGI script to provide per-drive storage data
2. **Missing fonts** - Downloaded and added Lato woff2 font files to public/fonts/
3. **Device model display** - Added model info to status API and Sidebar component
4. **FileBrowser not loading** - Fixed deploy.sh overwriting our `filebrowser.js` with Pi's old version
   - Changed preserve logic to only copy Pi's filebrowser files if new ones don't exist
   - Our version includes `window.FileBrowser = FileBrowser;` export required for dynamic loading

### Tested On
- Raspberry Pi 4 Model B (tusbm3b)
- Raspberry Pi 5 Model B (tusbm3a)
- Radxa ROCK Pi 4C+ (tusbm3e)

## 2025-12-12 - WiFi Frequency Display

### Updated Components
- **`Sidebar.jsx`** - Added WiFi frequency display in Network section
  - Shows band (2.4 GHz, 5 GHz, or 6 GHz) in bold with raw frequency in regular weight
  - Example: **2.4 GHz** (2.412) or **5 GHz** (5.180)
  - Uses `wifi_freq` from status API (already collected by `iwgetid -r -f`)

## 2025-12-12 - Real-time Music Sync Progress

### Added
- **Real-time progress display during music sync** showing:
  - Progress bar with percentage
  - Bytes transferred (formatted: KB/MB/GB)
  - Transfer speed (e.g., "12.34MB/s")
  - ETA (e.g., "~1:23 remaining")

### New Files
- **`backend-scripts/copy-music.sh`** - Modified rsync script with `--info=progress2,stats2`
  - Kept in local repo to avoid modifying upstream teslausb repository
  - Outputs real-time progress to `/tmp/rsyncmusiclog.txt`
- **`cgi-bin/music_sync_progress.sh`** - CGI endpoint that parses rsync progress
  - Returns JSON: `{ active, bytesTransferred, percentage, speed, eta }`
  - Detects active sync via `pgrep -f "rsync.*musicarchive"`
- **`src/hooks/useMusicSyncProgress.js`** - React hook for polling progress
  - Polls every 1.5 seconds when music sync is active
  - Includes `formatBytes()` and `formatEta()` utility functions

### Updated Files
- **`src/components/SyncStatus.jsx`** - Display music sync progress
  - Shows progress bar with real percentage during music sync
  - Displays transferred bytes, speed, and ETA below progress bar
- **`src/components/Dashboard.jsx`** - Integrated music sync progress hook
  - Detects music sync state from log parsing
  - Enables progress polling only during active music sync
- **`src/services/api.js`** - Added `fetchMusicSyncProgress()` function
- **`src/styles/index.css`** - Added `.sync-progress-main` and `.sync-progress-secondary` styles
- **`deploy.sh`** - Updated to deploy backend scripts
  - Now uploads from local `backend-scripts/` directory
  - Installs to `/root/bin/` on Pi with automatic backup

### Technical Notes
- rsync `--info=progress2` outputs: `    1,234,567,890  45%   12.34MB/s    0:01:23`
- CGI script parses last matching line from log file
- Frontend only polls progress endpoint when music sync is detected from archiveloop.log
- Backend script changes kept separate from upstream teslausb repo for clean commits

## 2025-12-13 - Music Sync Progress Fix

### Fixed
- **CGI script carriage return issue** - rsync uses `\r` (carriage return) for in-place progress updates, which was corrupting the JSON output
  - Added `tr -d '\r'` to strip carriage returns before parsing
  - Changed from heredoc to echo statements for more reliable JSON output
  - Made regex patterns more flexible for different rsync output formats
  - Simplified pgrep pattern from `rsync.*musicarchive` to `rsync.*music`

### Tested On
- Raspberry Pi 4 Model B running Armbian (tusbm3b)
