import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { fetchMusicSyncProgress } from '../services/api';

/**
 * Hook for polling music sync progress
 * @param {boolean} enabled - Whether to enable polling (should be true when music sync is active)
 * @param {number} pollInterval - Polling interval in ms (default 1500)
 * @returns {Object} Music sync progress data
 */
export function useMusicSyncProgress(enabled = false, pollInterval = 1500) {
  const [progress, setProgress] = useState({
    active: false,
    bytesTransferred: 0,
    percentage: 0,
    speed: '',
    eta: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const enabledRef = useRef(enabled);

  const refresh = useCallback(async () => {
    try {
      const data = await fetchMusicSyncProgress();
      setProgress(data);
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update ref when enabled changes
  useEffect(() => {
    enabledRef.current = enabled;
  }, [enabled]);

  useEffect(() => {
    if (!enabled) {
      // Reset progress when disabled
      setProgress({
        active: false,
        bytesTransferred: 0,
        percentage: 0,
        speed: '',
        eta: '',
      });
      return;
    }

    setLoading(true);
    refresh(); // Initial fetch

    const interval = setInterval(() => {
      if (enabledRef.current) {
        refresh();
      }
    }, pollInterval);

    return () => clearInterval(interval);
  }, [enabled, pollInterval, refresh]);

  return {
    ...progress,
    loading,
    error,
    refresh,
  };
}

/**
 * Format bytes to human-readable string
 * @param {number} bytes - Bytes to format
 * @returns {string} Formatted string (e.g., "1.23 GB")
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

/**
 * Format ETA to human-readable string
 * @param {string} eta - ETA in format "H:MM:SS" or "MM:SS"
 * @returns {string} Formatted string (e.g., "~5:23 remaining")
 */
export function formatEta(eta) {
  if (!eta || eta === '0:00:00') return '';

  // Remove leading zeros from hours if present
  const cleaned = eta.replace(/^0:/, '');
  return `~${cleaned} remaining`;
}

export default useMusicSyncProgress;
