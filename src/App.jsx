import { useState, useEffect } from 'preact/hooks';
import { useStatus } from './hooks/useStatus';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { VideoViewer } from './components/VideoViewer';
import { FileBrowser } from './components/FileBrowser';
import { LogViewer } from './components/LogViewer';
import { LoadingScreen } from './components/LoadingScreen';
import { CarIcon } from './components/Icons';

// Tab definitions
const TABS = {
  DASHBOARD: 'dashboard',
  VIEWER: 'viewer',
  FILES: 'files',
  LOGS: 'logs',
};

export function App() {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const { status, config, storage, computed, loading, error, lastUpdate, refresh } = useStatus(5000);

  // Note: Dashboard is always the default tab, no auto-switching

  // Determine which tabs are available
  const availableTabs = [];
  availableTabs.push({ id: TABS.DASHBOARD, label: 'Dashboard' });

  if (config?.has_cam === 'yes') {
    availableTabs.push({ id: TABS.VIEWER, label: 'Viewer' });
  }

  if (config?.has_music === 'yes' || config?.has_lightshow === 'yes' || config?.has_boombox === 'yes') {
    availableTabs.push({ id: TABS.FILES, label: 'Files' });
  }

  availableTabs.push({ id: TABS.LOGS, label: 'Logs' });

  if (loading && !status) {
    return <LoadingScreen />;
  }

  if (error && !status) {
    return (
      <div className="error-container">
        <span>Failed to load: {error}</span>
        <button className="retry-btn" onClick={refresh}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="app-shell">
      {/* Top bar */}
      <div className="app-topbar">
        <div className="app-topbar-title">
          <CarIcon />
          <span>TeslaUSB</span>
        </div>
        <div className="app-topbar-actions">
          <span className={`app-status ${computed?.drivesActive ? 'healthy' : 'warning'}`}>
            {computed?.drivesActive ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Header with tabs */}
      <Header
        tabs={availableTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastUpdate={lastUpdate}
        onRefresh={refresh}
      />

      {/* Mobile quick status bar */}
      <div className="mobile-quick-status">
        <div className="quick-status-item">
          <div className={`status-dot-mini ${computed?.drivesActive ? 'healthy' : 'unhealthy'}`} />
          <span className="quick-status-label">USB</span>
        </div>
        <div className="quick-status-item">
          <div className={`status-dot-mini ${computed?.wifiConnected ? 'healthy' : 'unhealthy'}`} />
          <span className="quick-status-label">WiFi</span>
        </div>
        <div className="quick-status-item">
          <div className={`status-dot-mini ${(computed?.cpuTempC && parseFloat(computed.cpuTempC) < 70) ? 'healthy' : 'unhealthy'}`} />
          <span className="quick-status-label">{computed?.cpuTempC}°C</span>
        </div>
      </div>

      {/* Main content */}
      <div className="app-body">
        {/* Sidebar - only on dashboard */}
        {activeTab === TABS.DASHBOARD && (
          <Sidebar
            status={status}
            computed={computed}
            config={config}
            expanded={sidebarExpanded}
            onToggle={() => setSidebarExpanded(!sidebarExpanded)}
            onRefresh={refresh}
          />
        )}

        {/* Tab content */}
        <main className="app-main">
          {activeTab === TABS.DASHBOARD && (
            <Dashboard
              status={status}
              computed={computed}
              config={config}
              storage={storage}
              onRefresh={refresh}
            />
          )}

          {activeTab === TABS.VIEWER && config?.has_cam === 'yes' && (
            <VideoViewer />
          )}

          {activeTab === TABS.FILES && (
            <FileBrowser config={config} />
          )}

          {activeTab === TABS.LOGS && (
            <LogViewer />
          )}
        </main>
      </div>
    </div>
  );
}

export default App;
