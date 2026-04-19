import { useState, useEffect } from 'preact/hooks';
import { subscribe } from '../services/eventStream';

/**
 * Music sync progress — now sourced from the shared SSE stream.
 * `enabled` is kept for API compatibility but is effectively ignored
 * under SSE (the server-side events.sh always emits sync data; the cost
 * of receiving it is negligible).
 */
export function useMusicSyncProgress(_enabled = false) {
  const [progress, setProgress] = useState({
    active: false,
    bytesTransferred: 0,
    percentage: 0,
    speed: '',
    eta: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    return subscribe((snapshot) => {
      if (snapshot.music) setProgress(snapshot.music);
      setError(snapshot.error);
    });
  }, []);

  return {
    ...progress,
    loading: false,
    error,
    refresh: () => {},
  };
}

export function useCamSyncProgress(_enabled = false) {
  const [progress, setProgress] = useState({
    active: false,
    bytesTransferred: 0,
    percentage: 0,
    speed: '',
    eta: '',
    filesDone: 0,
    filesTotal: 0,
    currentFile: '',
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    return subscribe((snapshot) => {
      if (snapshot.cam) setProgress(snapshot.cam);
      setError(snapshot.error);
    });
  }, []);

  return {
    ...progress,
    loading: false,
    error,
    refresh: () => {},
  };
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B';

  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const k = 1024;
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return `${(bytes / Math.pow(k, i)).toFixed(i > 0 ? 2 : 0)} ${units[i]}`;
}

export function formatEta(eta) {
  if (!eta || eta === '0:00:00') return '';
  const cleaned = eta.replace(/^0:/, '');
  return `~${cleaned} remaining`;
}

export default useMusicSyncProgress;
