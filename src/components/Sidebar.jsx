import { useState } from 'preact/hooks';
import {
  CpuIcon,
  WifiIcon,
  UsbIcon,
  CameraIcon,
  ChevronDownIcon,
  PowerIcon,
  SpeedIcon,
  BluetoothIcon,
  SwitchIcon,
} from './Icons';
import { toggleDrives, reboot, runSpeedTest, startBLEPairing, checkBLEStatus } from '../services/api';

export function Sidebar({ status, computed, config, expanded, onToggle, onRefresh }) {
  const [usbLoading, setUsbLoading] = useState(false);
  const [rebootLoading, setRebootLoading] = useState(false);
  const [speedTestRunning, setSpeedTestRunning] = useState(false);
  const [speedTestResult, setSpeedTestResult] = useState(null);
  const [bleStatus, setBleStatus] = useState(null);

  const handleToggleDrives = async () => {
    setUsbLoading(true);
    try {
      await toggleDrives();
      setTimeout(onRefresh, 1000);
    } catch (e) {
      console.error('Toggle drives failed:', e);
    } finally {
      setUsbLoading(false);
    }
  };

  const handleReboot = async () => {
    if (confirm('Are you sure you want to restart TeslaUSB?')) {
      setRebootLoading(true);
      try {
        await reboot();
      } catch (e) {
        console.error('Reboot failed:', e);
      }
    }
  };

  const handleSpeedTest = async () => {
    setSpeedTestRunning(true);
    setSpeedTestResult(null);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      await runSpeedTest(
        (speed) => setSpeedTestResult(speed.toFixed(1)),
        controller.signal
      );
    } catch (e) {
      if (e.name !== 'AbortError') {
        console.error('Speed test failed:', e);
      }
    } finally {
      clearTimeout(timeout);
      setSpeedTestRunning(false);
    }
  };

  const handleBLEPairing = async () => {
    setBleStatus('pairing');
    try {
      const started = await startBLEPairing();
      if (started) {
        for (let i = 0; i < 60; i++) {
          await new Promise(r => setTimeout(r, 2000));
          const paired = await checkBLEStatus();
          if (paired) {
            setBleStatus('paired');
            return;
          }
        }
        setBleStatus('timeout');
      } else {
        setBleStatus('error');
      }
    } catch (e) {
      console.error('BLE pairing failed:', e);
      setBleStatus('error');
    }
  };

  return (
    <aside className={`app-sidebar ${expanded ? 'expanded' : ''}`}>
      {/* System Info */}
      <div className="device-info">
        <div className="device-header">
          <CpuIcon />
          <span>System</span>
          <button className="sidebar-toggle-btn" onClick={onToggle}>
            <ChevronDownIcon className={expanded ? 'rotate-180' : ''} />
          </button>
        </div>
        <div className="info-list">
          {status?.device_model && (
            <div className="info-item">
              <span className="info-label">Model</span>
              <span className="info-value small-text">{status.device_model}</span>
            </div>
          )}
          <div className="info-item">
            <span className="info-label">Uptime</span>
            <span className="info-value">{computed?.uptimeFormatted || '-'}</span>
          </div>
          <div className="info-item">
            <span className="info-label">CPU Temp</span>
            <span className={`info-value ${getTempClass(computed?.cpuTempC)}`}>
              {computed?.cpuTempC ? `${computed.cpuTempC}°C` : '-'}
            </span>
          </div>
          <div className="info-item clickable" onClick={handleToggleDrives}>
            <span className="info-label">USB Drives</span>
            <button
              className={`toggle-btn ${computed?.drivesActive ? 'active' : 'danger'}`}
              disabled={usbLoading}
            >
              {usbLoading && <UsbIcon style={{ width: 12, height: 12 }} className="spinning" />}
              {computed?.drivesActive ? 'Disconnect from host' : 'Connect to host'}
            </button>
          </div>
          <div className="info-item clickable" onClick={handleReboot}>
            <span className="info-label">Power</span>
            <button className="toggle-btn danger" disabled={rebootLoading}>
              {rebootLoading && <PowerIcon style={{ width: 12, height: 12 }} className="spinning" />}
              Restart
            </button>
          </div>
        </div>
      </div>

      {/* Network Info */}
      <div className="device-info">
        <div className="device-header">
          <WifiIcon />
          <span>Network</span>
        </div>
        <div className="info-list">
          {status?.wifi_ssid && (
            <>
              <div className="info-item">
                <span className="info-label">WiFi SSID</span>
                <span className="info-value">{status.wifi_ssid}</span>
              </div>
              {status?.wifi_freq && (
                <div className="info-item">
                  <span className="info-label">Frequency</span>
                  <span className="info-value">{formatWifiFreq(status.wifi_freq)}</span>
                </div>
              )}
              <div className="info-item">
                <span className="info-label">Signal</span>
                <span className="info-value">{computed?.wifiSignalPercent || 0}%</span>
              </div>
              <div className="info-item">
                <span className="info-label">IP Address</span>
                <span className="info-value small-text">{status.wifi_ip || '-'}</span>
              </div>
            </>
          )}
          {status?.ether_ip && (
            <>
              <div className="info-item">
                <span className="info-label">Ethernet</span>
                <span className="info-value">{status.ether_speed || 'Connected'}</span>
              </div>
              <div className="info-item">
                <span className="info-label">IP Address</span>
                <span className="info-value small-text">{status.ether_ip}</span>
              </div>
            </>
          )}
          {!status?.wifi_ssid && !status?.ether_ip && (
            <div className="info-item">
              <span className="info-label">Status</span>
              <span className="info-value status-unhealthy">Not Connected</span>
            </div>
          )}
          {/* Speed Test */}
          <div className="info-item">
            <span className="info-label">Speed Test</span>
            <span className="info-value-with-action">
              {speedTestResult && <span className="speed-result">{speedTestResult} Mbps</span>}
              <button className="toggle-btn" onClick={handleSpeedTest} disabled={speedTestRunning}>
                {speedTestRunning && <SpeedIcon style={{ width: 12, height: 12 }} className="spinning" />}
                {speedTestRunning ? 'Testing...' : 'Run'}
              </button>
            </span>
          </div>
          {/* BLE Pairing - only if configured */}
          {config?.uses_ble === 'yes' && (
            <div className="info-item clickable" onClick={handleBLEPairing}>
              <span className="info-label">Bluetooth</span>
              <button className="toggle-btn" disabled={bleStatus === 'pairing'}>
                {bleStatus === 'pairing' && <BluetoothIcon style={{ width: 12, height: 12 }} className="spinning" />}
                {bleStatus === 'pairing'
                  ? 'Pairing...'
                  : bleStatus === 'paired'
                  ? 'Paired'
                  : bleStatus === 'error'
                  ? 'Failed'
                  : 'Pair'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Snapshots Info */}
      {computed?.snapshotCount > 0 && (
        <div className="device-info">
          <div className="device-header">
            <CameraIcon />
            <span>Snapshots</span>
          </div>
          <div className="info-list">
            <div className="info-item">
              <span className="info-label">Count</span>
              <span className="info-value">{computed.snapshotCount}</span>
            </div>
            {status?.snapshot_oldest && (
              <div className="info-item">
                <span className="info-label">Oldest</span>
                <span className="info-value compact-date">
                  {formatSnapshotDate(status.snapshot_oldest)}
                </span>
              </div>
            )}
            {status?.snapshot_newest && (
              <div className="info-item">
                <span className="info-label">Newest</span>
                <span className="info-value compact-date">
                  {formatSnapshotDate(status.snapshot_newest)}
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Switch UI */}
      <div className="device-info">
        <div className="device-header">
          <SwitchIcon />
          <span>Switch UI</span>
        </div>
        <div className="info-list">
          <div className="info-item">
            <a href="/" className="ui-switch-link">Standard UI</a>
          </div>
          <div className="info-item">
            <a href="/new/" className="ui-switch-link">Vue UI</a>
          </div>
        </div>
      </div>
    </aside>
  );
}

function getTempClass(temp) {
  if (!temp) return '';
  const t = parseFloat(temp);
  if (t >= 80) return 'status-unhealthy';
  if (t >= 70) return 'status-degraded';
  return 'status-healthy';
}

function getStorageClass(percent) {
  if (!percent) return 'blue';
  if (percent >= 90) return 'red';
  if (percent >= 75) return 'yellow';
  return 'blue';
}

function formatSnapshotDate(timestamp) {
  if (!timestamp) return '-';
  try {
    const date = new Date(parseInt(timestamp, 10) * 1000);
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch {
    return timestamp;
  }
}

function formatWifiFreq(freq) {
  if (!freq) return '-';
  // iwgetid returns frequency like "2.412 GHz" or just the number
  const match = freq.match(/(\d+\.?\d*)/);
  if (match) {
    const ghz = parseFloat(match[1]);
    const rawFreq = <span style={{ fontWeight: 'normal' }}> ({ghz.toFixed(3)})</span>;
    // Show band label (2.4 or 5 GHz) with actual frequency
    if (ghz >= 2.4 && ghz < 2.5) {
      return <>2.4 GHz{rawFreq}</>;
    } else if (ghz >= 5 && ghz < 6) {
      return <>5 GHz{rawFreq}</>;
    } else if (ghz >= 6) {
      return <>6 GHz{rawFreq}</>;
    }
    return `${ghz} GHz`;
  }
  return freq;
}

export default Sidebar;
