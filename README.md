# TeslaUSB Modern Web UI

A modern, React-based replacement for the TeslaUSB web interface. Built with Preact for minimal bundle size and optimized for Raspberry Pi.

## Features

- **Dashboard** - System status, storage visualization, sync progress, quick actions
- **Video Viewer** - 6-camera synchronized playback with multiple layout options
- **File Browser** - Drag-and-drop file management for Music, LightShow, and Boombox drives
- **Log Viewer** - Real-time log tailing for archive and setup logs, plus diagnostics

## Tech Stack

- **Preact** - 3KB React alternative for minimal bundle size
- **Vite** - Fast build tool with excellent tree-shaking
- **No external UI framework** - Custom CSS for maximum performance

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Deployment

### Option 1: Using the deploy script (recommended)

The deploy script automatically handles TeslaUSB's read-only filesystem.

```bash
# Build and deploy to your Raspberry Pi
./deploy.sh pi@192.168.1.100

# Or using hostname
./deploy.sh pi@teslausb.local
```

### Option 2: Manual deployment

TeslaUSB uses a **read-only filesystem** by default. You must remount it as read-write before making changes.

1. Build the project:
   ```bash
   npm run build
   ```

2. SSH into your Raspberry Pi and remount the filesystem:
   ```bash
   ssh pi@your-pi-ip
   sudo -i
   bin/remountfs_rw
   ```

3. Copy the `dist/` contents (from another terminal):
   ```bash
   scp -r dist/* pi@your-pi-ip:/var/www/html/
   ```

4. Ensure CGI scripts are preserved - the new UI needs the existing `/var/www/html/cgi-bin/` directory

5. The filesystem will return to read-only on next reboot, or manually:
   ```bash
   sudo mount -o remount,ro /
   ```

## Project Structure

```
teslausb-www-react/
├── src/
│   ├── components/      # UI components
│   │   ├── Dashboard.jsx
│   │   ├── VideoViewer.jsx
│   │   ├── FileBrowser.jsx
│   │   ├── LogViewer.jsx
│   │   └── ...
│   ├── hooks/           # Custom hooks
│   │   ├── useStatus.js
│   │   └── useLogTail.js
│   ├── services/        # API layer
│   │   └── api.js
│   ├── styles/          # CSS
│   │   └── index.css
│   ├── App.jsx          # Main app component
│   └── main.jsx         # Entry point
├── public/              # Static assets
│   ├── fonts/           # Lato font files (for offline use)
│   ├── icons/           # PWA icons
│   └── manifest.json    # PWA manifest
├── deploy.sh            # Deployment script
└── vite.config.js       # Vite configuration
```

## Offline Font Support

The UI uses the Lato font family. When internet is available, fonts load from Google Fonts CDN. For offline use (typical in a car), place the following font files in `public/fonts/`:

- `lato-regular.woff2`
- `lato-bold.woff2`
- `lato-italic.woff2`

You can download these from [Google Fonts](https://fonts.google.com/specimen/Lato).

## API Endpoints

The UI communicates with the existing TeslaUSB CGI scripts:

| Endpoint | Description |
|----------|-------------|
| `/cgi-bin/status.sh` | System status (CPU temp, disk space, etc.) |
| `/cgi-bin/config.sh` | Feature configuration |
| `/cgi-bin/videolist.sh` | List of recorded videos |
| `/cgi-bin/trigger_sync.sh` | Trigger archive sync |
| `/cgi-bin/toggledrives.sh` | Connect/disconnect USB drives |
| `/cgi-bin/ls.sh` | Directory listing |
| `/cgi-bin/upload.sh` | File upload |
| `/cgi-bin/download.sh` | File download |

## Browser Support

- Chrome/Edge (recommended)
- Safari
- Firefox
- Mobile browsers (iOS Safari, Chrome for Android)

## Restoring the Original UI

If you need to restore the original TeslaUSB UI:

```bash
# On your Raspberry Pi
sudo rm -rf /var/www/html
sudo mv /var/www/html.backup /var/www/html
```

## License

Same as TeslaUSB project.
