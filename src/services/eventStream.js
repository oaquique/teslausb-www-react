// Shared snapshot poller. All hooks that used to poll independently
// (`useStatus`, `useMusicSyncProgress`, `useCamSyncProgress`) now read
// from this singleton instead — one coalesced request every POLL_MS
// replaces 6 concurrent pollers at 1.5–5s intervals, for roughly an
// 80% drop in CGI invocations on the Pi.
//
// Why polling and not SSE: fcgiwrap buffers ~8 KB before flushing and
// does not support true streaming. We'd need to replace the FastCGI
// daemon to make SSE work. Merged polling gets most of the win with
// zero backend rearchitecture.

const ENDPOINT = '/cgi-bin/snapshot.sh';
const POLL_MS = 3000;
// After this many consecutive failures the UI surfaces a "disconnected"
// banner. Browser may still be retrying; this is just a user cue.
const FAIL_THRESHOLD = 2;

const STATUS_DEFAULTS = { status: null, config: null, storage: null };
const SYNC_DEFAULTS = {
  music: { active: false, bytesTransferred: 0, percentage: 0, speed: '', eta: '' },
  cam: {
    active: false,
    bytesTransferred: 0,
    percentage: 0,
    speed: '',
    eta: '',
    filesDone: 0,
    filesTotal: 0,
    currentFile: '',
  },
};

let timer = null;
let inflight = null;
let consecutiveFailures = 0;
const subscribers = new Set();
let statusSnapshot = STATUS_DEFAULTS;
let syncSnapshot = SYNC_DEFAULTS;
let lastError = null;
let lastUpdate = null;
// Last `version` field from snapshot.sh — the UI build currently
// deployed to the Pi. Compared against the running bundle's
// __APP_VERSION__ to detect drift and prompt a reload.
let serverVersion = null;
// 'idle' before first attempt, 'connecting' during initial fetch,
// 'open' after first success, 'disconnected' after FAIL_THRESHOLD
// consecutive failures.
let connectionState = 'idle';

function notify() {
  const snapshot = {
    ...statusSnapshot,
    music: syncSnapshot.music,
    cam: syncSnapshot.cam,
    serverVersion,
    error: lastError,
    lastUpdate,
    connectionState,
  };
  subscribers.forEach((cb) => {
    try {
      cb(snapshot);
    } catch (e) {
      console.error('snapshot subscriber error', e);
    }
  });
}

async function fetchSnapshot() {
  if (inflight) return inflight;
  if (connectionState === 'idle') {
    connectionState = 'connecting';
    notify();
  }

  inflight = (async () => {
    try {
      const res = await fetch(ENDPOINT, { cache: 'no-store' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      statusSnapshot = {
        status: data.status ?? null,
        config: data.config ?? null,
        storage: data.storage ?? null,
      };
      syncSnapshot = {
        music: { ...SYNC_DEFAULTS.music, ...(data.music ?? {}) },
        cam: { ...SYNC_DEFAULTS.cam, ...(data.cam ?? {}) },
      };
      serverVersion = data.version ?? null;
      lastUpdate = new Date();
      lastError = null;
      consecutiveFailures = 0;
      connectionState = 'open';
    } catch (err) {
      lastError = err.message;
      consecutiveFailures += 1;
      if (consecutiveFailures >= FAIL_THRESHOLD) {
        connectionState = 'disconnected';
      }
    } finally {
      inflight = null;
      notify();
    }
  })();

  return inflight;
}

function startPolling() {
  if (timer) return;
  fetchSnapshot();
  timer = setInterval(fetchSnapshot, POLL_MS);
}

function stopPolling() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

/**
 * Subscribe to the shared snapshot stream. The callback is invoked
 * immediately with the current snapshot, then on every poll. Returns
 * an unsubscribe function. Polling starts on first subscriber and
 * stops when the last subscriber unsubscribes (resource conservation).
 */
export function subscribe(cb) {
  subscribers.add(cb);
  if (subscribers.size === 1) startPolling();
  cb({
    ...statusSnapshot,
    music: syncSnapshot.music,
    cam: syncSnapshot.cam,
    serverVersion,
    error: lastError,
    lastUpdate,
    connectionState,
  });
  return () => {
    subscribers.delete(cb);
    if (subscribers.size === 0) stopPolling();
  };
}

/**
 * Force an immediate out-of-cycle fetch. Used by the explicit Refresh
 * button; the regular polling cadence continues unchanged.
 */
export function reconnect() {
  fetchSnapshot();
}
