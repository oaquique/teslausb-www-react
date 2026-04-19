import { useEffect, useState } from 'preact/hooks';
import { subscribe } from '../services/eventStream';

/**
 * Subscribes to the shared snapshot stream and exposes the deployed
 * server version when it differs from the running bundle's
 * __APP_VERSION__. Returns null while aligned, or the new version
 * string once the Pi reports a fresher build.
 *
 * Cheaper than JobCommand's dedicated /api/openapi.json poll — we're
 * already hitting snapshot.sh every 3s for status, so drift is
 * detected within one tick.
 */
export function useVersionCheck() {
  const [newer, setNewer] = useState(null);

  useEffect(() => {
    return subscribe((snap) => {
      if (!snap.serverVersion) return;
      if (snap.serverVersion !== __APP_VERSION__) {
        setNewer(snap.serverVersion);
      }
    });
  }, []);

  return newer;
}
