import { useState, useEffect, useCallback } from 'preact/hooks';
import { fetchStatus, fetchConfig, fetchStorage } from '../services/api';

/**
 * Hook for managing system status with polling
 * @param {number} pollInterval - Polling interval in ms (default 5000)
 * @returns {Object} Status, config, storage, loading state, and refresh function
 */
export function useStatus(pollInterval = 5000) {
  const [status, setStatus] = useState(null);
  const [config, setConfig] = useState(null);
  const [storage, setStorage] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const [statusData, configData, storageData] = await Promise.all([
        fetchStatus(),
        fetchConfig(),
        fetchStorage().catch(() => null), // Storage API is optional
      ]);
      setStatus(statusData);
      setConfig(configData);
      setStorage(storageData);
      setLastUpdate(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, pollInterval);
    return () => clearInterval(interval);
  }, [refresh, pollInterval]);

  // Compute derived values
  const computed = status ? {
    cpuTempC: status.cpu_temp ? (parseInt(status.cpu_temp, 10) / 1000).toFixed(1) : null,
    uptimeFormatted: formatUptime(parseInt(status.uptime || '0', 10)),
    diskUsedPercent: status.total_space && status.free_space
      ? Math.round(((parseInt(status.total_space, 10) - parseInt(status.free_space, 10)) / parseInt(status.total_space, 10)) * 100)
      : 0,
    diskUsedGB: status.total_space && status.free_space
      ? ((parseInt(status.total_space, 10) - parseInt(status.free_space, 10)) / (1024 * 1024 * 1024)).toFixed(1)
      : '0',
    diskTotalGB: status.total_space
      ? (parseInt(status.total_space, 10) / (1024 * 1024 * 1024)).toFixed(1)
      : '0',
    diskFreeGB: status.free_space
      ? (parseInt(status.free_space, 10) / (1024 * 1024 * 1024)).toFixed(1)
      : '0',
    drivesActive: status.drives_active === 'yes',
    wifiConnected: !!status.wifi_ssid && status.wifi_ssid !== '',
    wifiSignalPercent: parseWifiSignal(status.wifi_strength),
    ethernetConnected: !!status.ether_ip && status.ether_ip !== '',
    snapshotCount: parseInt(status.num_snapshots || '0', 10),
  } : null;

  return {
    status,
    config,
    storage,
    computed,
    loading,
    error,
    lastUpdate,
    refresh,
  };
}

/**
 * Format uptime seconds into human-readable string
 * @param {number} seconds - Uptime in seconds
 * @returns {string} Formatted uptime
 */
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

/**
 * Parse WiFi signal strength string
 * @param {string} strength - e.g., "40/70"
 * @returns {number} Signal percentage
 */
function parseWifiSignal(strength) {
  if (!strength) return 0;
  const parts = strength.split('/');
  if (parts.length !== 2) return 0;
  const [current, max] = parts.map(Number);
  if (isNaN(current) || isNaN(max) || max === 0) return 0;
  return Math.round((current / max) * 100);
}

export default useStatus;
