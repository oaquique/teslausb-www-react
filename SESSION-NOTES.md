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
