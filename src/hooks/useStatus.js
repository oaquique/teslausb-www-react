import { useState, useEffect, useCallback } from 'preact/hooks';
import { subscribe, reconnect } from '../services/eventStream';

/**
 * Subscribes to the shared SSE event stream and returns the same shape
 * the old polling-based useStatus did, so the rest of the UI is
 * unchanged. `refresh()` tears down and rebuilds the SSE connection.
 */
export function useStatus() {
  const [state, setState] = useState({
    status: null,
    config: null,
    storage: null,
    error: null,
    lastUpdate: null,
    connectionState: 'idle',
  });

  useEffect(() => {
    const unsubscribe = subscribe((snapshot) => {
      setState({
        status: snapshot.status,
        config: snapshot.config,
        storage: snapshot.storage,
        error: snapshot.error,
        lastUpdate: snapshot.lastUpdate,
        connectionState: snapshot.connectionState,
      });
    });
    return unsubscribe;
  }, []);

  const refresh = useCallback(() => reconnect(), []);

  const computed = state.status
    ? {
        cpuTempC: state.status.cpu_temp
          ? (parseInt(state.status.cpu_temp, 10) / 1000).toFixed(1)
          : null,
        uptimeFormatted: formatUptime(parseInt(state.status.uptime || '0', 10)),
        diskUsedPercent:
          state.status.total_space && state.status.free_space
            ? Math.round(
                ((parseInt(state.status.total_space, 10) -
                  parseInt(state.status.free_space, 10)) /
                  parseInt(state.status.total_space, 10)) *
                  100
              )
            : 0,
        diskUsedGB:
          state.status.total_space && state.status.free_space
            ? (
                (parseInt(state.status.total_space, 10) -
                  parseInt(state.status.free_space, 10)) /
                (1024 * 1024 * 1024)
              ).toFixed(1)
            : '0',
        diskTotalGB: state.status.total_space
          ? (parseInt(state.status.total_space, 10) / (1024 * 1024 * 1024)).toFixed(1)
          : '0',
        diskFreeGB: state.status.free_space
          ? (parseInt(state.status.free_space, 10) / (1024 * 1024 * 1024)).toFixed(1)
          : '0',
        drivesActive: state.status.drives_active === 'yes',
        wifiConnected: !!state.status.wifi_ssid && state.status.wifi_ssid !== '',
        wifiSignalPercent: parseWifiSignal(state.status.wifi_strength),
        ethernetConnected: !!state.status.ether_ip && state.status.ether_ip !== '',
        snapshotCount: parseInt(state.status.num_snapshots || '0', 10),
      }
    : null;

  const loading = !state.status && state.connectionState !== 'disconnected';

  return {
    status: state.status,
    config: state.config,
    storage: state.storage,
    computed,
    loading,
    error: state.error,
    lastUpdate: state.lastUpdate,
    connectionState: state.connectionState,
    refresh,
  };
}

function formatUptime(seconds) {
  if (!seconds || isNaN(seconds)) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (secs > 0 || parts.length === 0) parts.push(`${secs}s`);

  return parts.join(' ');
}

function parseWifiSignal(strength) {
  if (!strength) return 0;
  const parts = strength.split('/');
  if (parts.length !== 2) return 0;
  const [current, max] = parts.map(Number);
  if (isNaN(current) || isNaN(max) || max === 0) return 0;
  return Math.round((current / max) * 100);
}

export default useStatus;
