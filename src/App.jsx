import { useState, useEffect } from 'preact/hooks';
import { useStatus } from './hooks/useStatus';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { Dashboard } from './components/Dashboard';
import { VideoViewer } from './components/VideoViewer';
import { FileBrowser } from './components/FileBrowser';
import { LogViewer } from './components/LogViewer';
import { LoadingScreen } from './components/LoadingScreen';
import { ErrorBoundary } from './components/ErrorBoundary';
import { VersionBanner } from './components/VersionBanner';
import { ToastContainer } from './components/ToastContainer';
import { ToastProvider } from './hooks/useToast';
import { CarIcon, CheckIcon, AlertIcon } from './components/Icons';

// Tab definitions
const TABS = {
  DASHBOARD: 'dashboard',
  VIEWER: 'viewer',
  FILES: 'files',
  LOGS: 'logs',
};

export function App() {
  // Toast provider wraps the entire tree so any descendant — loading screen,
  // error screen, or main shell — can publish toasts. ToastContainer is the
  // single root sink; it lives at the outermost level so it renders over any
  // content regardless of which early-return path we take.
  return (
    <ToastProvider>
      <AppInner />
      <ToastContainer />
    </ToastProvider>
  );
}

function AppInner() {
  const [activeTab, setActiveTab] = useState(TABS.DASHBOARD);
  const [sidebarExpanded, setSidebarExpanded] = useState(false);
  const {
    status,
    config,
    storage,
    computed,
    loading,
    error,
    lastUpdate,
    connectionState,
    refresh,
  } = useStatus();

  // Note: Dashboard is always the default tab, no auto-switching

  // Determine which tabs are available
  const availableTabs = [];
  availableTabs.push({ id: TABS.DASHBOARD, label: 'Dashboard' });

  if (config?.has_cam === 'yes') {
    availableTabs.push({ id: TABS.VIEWER, label: 'Viewer' });
  }

  if (
    config?.has_music === 'yes' ||
    config?.has_lightshow === 'yes' ||
    config?.has_boombox === 'yes'
  ) {
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
      {/* Skip link — the first focusable element on the page. Keyboard
          users tabbing in can jump straight past the nav to the content. */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Top bar */}
      <header className="app-topbar">
        <h1 className="app-topbar-title">
          <CarIcon aria-hidden="true" />
          <span>TeslaUSB</span>
        </h1>
        <div className="app-topbar-actions">
          {connectionState === 'disconnected' && (
            <span
              className="app-status warning app-status--stream"
              role="status"
              aria-label="Live connection lost, retrying"
            >
              <AlertIcon className="app-status-icon" aria-hidden="true" />
              Reconnecting
            </span>
          )}
          <span
            className={`app-status ${computed?.drivesActive ? 'healthy' : 'warning'}`}
            role="status"
          >
            {computed?.drivesActive ? (
              <CheckIcon className="app-status-icon" aria-hidden="true" />
            ) : (
              <AlertIcon className="app-status-icon" aria-hidden="true" />
            )}
            {computed?.drivesActive ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </header>

      {/* Tab navigation */}
      <Header
        tabs={availableTabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        lastUpdate={lastUpdate}
        onRefresh={refresh}
      />

      {/* Mobile quick status bar */}
      <div className="mobile-quick-status" role="status" aria-label="System status">
        <div className="quick-status-item">
          <span
            className={`status-dot-mini ${computed?.drivesActive ? 'healthy' : 'unhealthy'}`}
            aria-hidden="true"
          />
          <span className="quick-status-label">USB</span>
        </div>
        <div className="quick-status-item">
          <span
            className={`status-dot-mini ${computed?.wifiConnected ? 'healthy' : 'unhealthy'}`}
            aria-hidden="true"
          />
          <span className="quick-status-label">WiFi</span>
        </div>
        <div className="quick-status-item">
          <span
            className={`status-dot-mini ${computed?.cpuTempC && parseFloat(computed.cpuTempC) < 70 ? 'healthy' : 'unhealthy'}`}
            aria-hidden="true"
          />
          <span className="quick-status-label" data-live>
            {computed?.cpuTempC}°C
          </span>
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

        {/* Tab content — each tab is wrapped in its own ErrorBoundary so a
             crash in one surface can't take out the rest of the app. */}
        <main className="app-main" id="main-content" tabIndex="-1">
          {activeTab === TABS.DASHBOARD && (
            <ErrorBoundary label="Dashboard">
              <Dashboard
                status={status}
                computed={computed}
                config={config}
                storage={storage}
                onRefresh={refresh}
              />
            </ErrorBoundary>
          )}

          {activeTab === TABS.VIEWER && config?.has_cam === 'yes' && (
            <ErrorBoundary label="Viewer">
              <VideoViewer />
            </ErrorBoundary>
          )}

          {activeTab === TABS.FILES && (
            <ErrorBoundary label="Files">
              <FileBrowser config={config} />
            </ErrorBoundary>
          )}

          {activeTab === TABS.LOGS && (
            <ErrorBoundary label="Logs">
              <LogViewer />
            </ErrorBoundary>
          )}
        </main>
      </div>

      <VersionBanner />
    </div>
  );
}

export default App;
