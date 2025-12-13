import { SyncIcon, CheckIcon, AlertIcon, ClockIcon } from './Icons';
import { formatBytes, formatEta } from '../hooks/useMusicSyncProgress';

/**
 * Compact Sync Status Card
 */
export function SyncStatus({ syncStatus, onTriggerSync, loading, musicProgress }) {
  const { state, totalFiles, archivedFiles, message, elapsedTime, lastActivity } = syncStatus;

  // Check if this is an active music sync with progress data
  const isMusicSync = message?.toLowerCase().includes('music') && state === 'archiving';
  const hasMusicProgress = musicProgress?.active && musicProgress?.percentage > 0;

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

  // Determine which progress to show
  const showMusicProgress = isMusicSync && hasMusicProgress;
  const showFileProgress = state === 'archiving' && totalFiles > 0 && !showMusicProgress;

  // Calculate progress percentage
  let progressPercent = null;
  if (showMusicProgress) {
    progressPercent = musicProgress.percentage;
  } else if (showFileProgress && archivedFiles > 0) {
    progressPercent = Math.min(Math.round((archivedFiles / totalFiles) * 100), 100);
  }

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
      {(showMusicProgress || showFileProgress || isActive) && (
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

      {/* Music sync progress details */}
      {showMusicProgress && (
        <div className="sync-details">
          <div className="sync-progress-main">
            {formatBytes(musicProgress.bytesTransferred)} transferred
            {progressPercent !== null && ` (${progressPercent}%)`}
          </div>
          {(musicProgress.speed || musicProgress.eta) && (
            <div className="sync-progress-secondary">
              {musicProgress.speed && <span>{musicProgress.speed}</span>}
              {musicProgress.speed && musicProgress.eta && <span> · </span>}
              {musicProgress.eta && <span>{formatEta(musicProgress.eta)}</span>}
            </div>
          )}
        </div>
      )}

      {/* File progress details (for TeslaCam archiving) */}
      {showFileProgress && (
        <div className="sync-details">
          {archivedFiles} / {totalFiles} files
          {progressPercent !== null && ` (${progressPercent}%)`}
        </div>
      )}

      {/* Last activity for idle state */}
      {!isActive && !showFileProgress && !showMusicProgress && lastActivity && (
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
