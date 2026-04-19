import { useState } from 'preact/hooks';
import { useVersionCheck } from '../hooks/useVersionCheck';
import { RefreshIcon, XIcon } from './Icons';

/**
 * Bottom-right toast that appears when the Pi reports a newer UI
 * version than the bundle the browser currently has cached. Dismissable
 * (local state) — but the next snapshot tick will re-raise it if the
 * mismatch persists, which is the correct behavior: gently persistent
 * but not blocking.
 */
export function VersionBanner() {
  const newer = useVersionCheck();
  const [dismissed, setDismissed] = useState(null);

  if (!newer || newer === dismissed) return null;

  return (
    <div className="version-banner" role="status" aria-live="polite">
      <div className="version-banner-body">
        <div className="version-banner-title">New version available</div>
        <div className="version-banner-copy">
          You&apos;re on <span className="version-banner-num">v{__APP_VERSION__}</span>; the
          server is on <span className="version-banner-num">v{newer}</span>. Reload to pick
          up the latest UI.
        </div>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          onClick={() => window.location.reload()}
        >
          <RefreshIcon aria-hidden="true" />
          <span>Reload</span>
        </button>
      </div>
      <button
        type="button"
        className="version-banner-close"
        onClick={() => setDismissed(newer)}
        aria-label="Dismiss version notice"
      >
        <XIcon aria-hidden="true" />
      </button>
    </div>
  );
}

export default VersionBanner;
