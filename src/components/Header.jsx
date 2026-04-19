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
        <nav className="dashboard-nav" aria-label="Main">
          {tabs.map((tab) => {
            const Icon = TAB_ICONS[tab.id] || DashboardIcon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                className={`nav-link ${isActive ? 'active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
                onClick={() => onTabChange(tab.id)}
              >
                <Icon aria-hidden="true" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="app-header-right desktop-status-bar">
        <span className="app-last-update">
          {lastUpdate && `Updated ${formatTime(lastUpdate)}`}
        </span>
        <button
          type="button"
          className="btn"
          onClick={onRefresh}
          aria-label="Refresh status"
        >
          <RefreshIcon aria-hidden="true" />
          <span>Refresh</span>
        </button>
      </div>
    </header>
  );
}

export default Header;
