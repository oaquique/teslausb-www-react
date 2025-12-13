# TeslaUSB React Web UI

A modern, React-based web interface for TeslaUSB. Built with Preact for minimal bundle size and optimized for Raspberry Pi.

## Features

- **Dashboard** - System status, storage visualization, real-time sync progress
- **Video Viewer** - 6-camera synchronized playback with multiple layout options
- **File Browser** - Drag-and-drop file management for Music, LightShow, and Boombox drives
- **Log Viewer** - Real-time log tailing with download option
- **Music Sync Progress** - Live progress display (percentage, speed, ETA) during music sync
- **UI Switcher** - Easy switching between Standard, Vue, and React UIs

## Installation

### Option 1: TeslaUSB Integration (Recommended)

If TeslaUSB includes this UI, it will be automatically installed at `/react/` during setup. Access it at:

```
http://<your-pi-ip>/react/
```

### Option 2: Manual Tarball Installation

Download the latest release and extract to your TeslaUSB:

```bash
# On your Raspberry Pi
sudo /root/bin/remountfs_rw
curl -L -o /tmp/reactui.tgz https://github.com/oaquique/teslausb-www-react/releases/latest/download/teslausb-react-ui.tgz
sudo tar -C /var/www/html -xf /tmp/reactui.tgz
```

Then access at `http://<your-pi-ip>/react/`

### Option 3: Full Replacement via Deploy Script

Replace the entire web UI (serves from root `/`):

```bash
# Build and deploy to your Raspberry Pi
./deploy.sh pi@192.168.1.100
```

## Switching Between UIs

TeslaUSB supports multiple web interfaces:

| UI | Path | Description |
|----|------|-------------|
| Standard | `/` | Original TeslaUSB interface |
| Vue | `/new/` | Vue-based alternative |
| React | `/react/` | This interface |

Use the "Switch UI" section in the sidebar to navigate between them.

## Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Build release tarball (for /react/ path)
./build-release.sh
```

## Tech Stack

- **Preact** - 3KB React alternative for minimal bundle size
- **Vite** - Fast build tool with excellent tree-shaking
- **Custom CSS** - No external UI framework for maximum performance

## Project Structure

```
teslausb-www-react/
├── src/
│   ├── components/      # UI components
│   ├── hooks/           # Custom React hooks
│   ├── services/        # API layer
│   └── styles/          # CSS
├── cgi-bin/             # CGI scripts for this UI
├── public/              # Static assets
├── deploy.sh            # Full deployment script
├── rollback.sh          # Restore previous UI
└── build-release.sh     # Create release tarball
```

## Rollback

If deployed via `deploy.sh`, you can restore the previous UI:

```bash
./rollback.sh pi@192.168.1.100
```

## License

Same as TeslaUSB project.
