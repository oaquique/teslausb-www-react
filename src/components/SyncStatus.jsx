import { SyncIcon, CheckIcon, AlertIcon, ClockIcon } from './Icons';

/**
 * Compact Sync Status Card
 */
export function SyncStatus({ syncStatus, onTriggerSync, loading }) {
  const { state, totalFiles, archivedFiles, message, elapsedTime, lastActivity } = syncStatus;

  const getStateInfo = () => {
    switch (state) {
      case 'idle':
        return { label: 'Idle', color: 'idle', description: 'Ready to archive' };
      case 'connecting':
        return { label: 'Connecting', color: 'connecting', description: message || 'Connecting to server...' };
      case 'archiving':
        return { label: 'Archiving', color: 'archiving', description: message || 'Syncing files...' };
      case 'complete':
        return { label: 'Complete', color: 'idle', description: message || 'Archive complete' };
      case 'error':
        return { label: 'Error', color: 'error', description: message || 'Archive failed' };
      default:
        return { label: 'Unknown', color: 'idle', description: 'Status unknown' };
    }
  };

  const stateInfo = getStateInfo();
  const isActive = state === 'archiving' || state === 'connecting';
  const showProgress = state === 'archiving' && totalFiles > 0;
  const progressPercent = showProgress && archivedFiles > 0
    ? Math.min(Math.round((archivedFiles / totalFiles) * 100), 100)
    : null;

  const formatLastActivity = (date) => {
    if (!date) return null;
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="sync-status-card">
      <div className="sync-status-header">
        <span className="sync-status-title">Sync Status</span>
        <div className="sync-status-indicator">
          <div className={`sync-status-dot ${stateInfo.color}`} />
          <span>{stateInfo.label}</span>
        </div>
      </div>

      <div className="sync-status-description">
        {stateInfo.description}
      </div>

      {/* Progress bar - shown during archiving */}
      {(showProgress || isActive) && (
        <div className="sync-progress-bar">
          <div
            className="sync-progress-fill"
            style={{
              width: progressPercent !== null ? `${progressPercent}%` : '100%',
              animation: progressPercent === null ? 'pulse 1.5s ease-in-out infinite' : 'none',
              opacity: progressPercent === null ? 0.6 : 1,
            }}
          />
        </div>
      )}

      {/* Progress details */}
      {showProgress && (
        <div className="sync-details">
          {archivedFiles} / {totalFiles} files
          {progressPercent !== null && ` (${progressPercent}%)`}
        </div>
      )}

      {/* Last activity for idle state */}
      {!isActive && !showProgress && lastActivity && (
        <div className="sync-details">
          Last sync: {formatLastActivity(lastActivity)}
        </div>
      )}

      {/* Elapsed time for complete state */}
      {elapsedTime && state === 'complete' && (
        <div className="sync-details">
          Completed in {elapsedTime}
        </div>
      )}

      {/* Manual trigger button */}
      {(state === 'idle' || state === 'complete' || state === 'error') && (
        <button
          className="btn btn-primary btn-sm"
          onClick={onTriggerSync}
          disabled={loading}
          style={{ marginTop: '0.75rem' }}
        >
          <SyncIcon style={{ width: 14, height: 14 }} className={loading ? 'spinning' : ''} />
          <span>{loading ? 'Starting...' : 'Sync Now'}</span>
        </button>
      )}
    </div>
  );
}

export default SyncStatus;
