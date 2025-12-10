import { DashboardIcon, VideoIcon, FolderIcon, TerminalIcon, RefreshIcon } from './Icons';

const TAB_ICONS = {
  dashboard: DashboardIcon,
  viewer: VideoIcon,
  files: FolderIcon,
  logs: TerminalIcon,
};

export function Header({ tabs, activeTab, onTabChange, lastUpdate, onRefresh }) {
  const formatTime = (date) => {
    if (!date) return '';
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <header className="app-header">
      <div className="app-header-left">
        <nav className="dashboard-nav">
          {tabs.map((tab) => {
            const Icon = TAB_ICONS[tab.id] || DashboardIcon;
            return (
              <button
                key={tab.id}
                className={`nav-link ${activeTab === tab.id ? 'active' : ''}`}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="app-header-right desktop-status-bar">
        <span className="app-last-update" style={{ marginRight: '12px' }}>
          {lastUpdate && `Updated ${formatTime(lastUpdate)}`}
        </span>
        <button className="btn" onClick={onRefresh}>
          <RefreshIcon />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
