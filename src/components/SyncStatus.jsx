import { SyncIcon, CheckIcon, AlertIcon, ClockIcon } from './Icons';
import { formatBytes, formatEta } from '../hooks/useMusicSyncProgress';

/**
 * Compact Sync Status Card
 */
export function SyncStatus({ syncStatus, onTriggerSync, loading, musicProgress, camProgress }) {
  const { state, message, elapsedTime, lastActivity } = syncStatus;

  // Determine sync type based on message
  const isMusicSync = message?.toLowerCase().includes('music') && state === 'archiving';
  const isCamSync = state === 'archiving' && !isMusicSync;

  // Check if we have active progress data from the respective APIs
  const hasMusicProgress = musicProgress?.active;
  const hasCamProgress = camProgress?.active;

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

  // Determine which progress source to use
  const showMusicProgress = isMusicSync && hasMusicProgress;
  const showCamProgress = isCamSync && hasCamProgress;
  const showAnyProgress = showMusicProgress || showCamProgress;

  // Calculate progress percentage from the active source
  let progressPercent = null;
  let progressDetails = null;

  if (showMusicProgress && musicProgress.percentage > 0) {
    progressPercent = musicProgress.percentage;
    progressDetails = {
      type: 'music',
      bytesTransferred: musicProgress.bytesTransferred,
      speed: musicProgress.speed,
      eta: musicProgress.eta,
    };
  } else if (showCamProgress) {
    // Use percentage if available, otherwise calculate from files
    if (camProgress.percentage > 0) {
      progressPercent = camProgress.percentage;
    } else if (camProgress.filesTotal > 0 && camProgress.filesDone > 0) {
      progressPercent = Math.min(Math.round((camProgress.filesDone / camProgress.filesTotal) * 100), 100);
    }
    progressDetails = {
      type: 'cam',
      bytesTransferred: camProgress.bytesTransferred,
      speed: camProgress.speed,
      eta: camProgress.eta,
      filesDone: camProgress.filesDone,
      filesTotal: camProgress.filesTotal,
      currentFile: camProgress.currentFile,
    };
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
      {isActive && (
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

      {/* Progress details - consistent format for both sync types */}
      {isActive && progressDetails && (
        <div className="sync-details">
          {/* Primary progress line */}
          <div className="sync-progress-main">
            {progressDetails.type === 'music' ? (
              <>
                {formatBytes(progressDetails.bytesTransferred)} transferred
                {progressPercent !== null && ` (${progressPercent}%)`}
              </>
            ) : (
              <>
                {progressDetails.bytesTransferred > 0 ? (
                  <>
                    {formatBytes(progressDetails.bytesTransferred)} transferred
                    {progressPercent !== null && ` (${progressPercent}%)`}
                  </>
                ) : progressDetails.filesTotal > 0 ? (
                  <>
                    {progressDetails.filesDone} / {progressDetails.filesTotal} files
                    {progressPercent !== null && ` (${progressPercent}%)`}
                  </>
                ) : (
                  'Archiving...'
                )}
              </>
            )}
          </div>
          {/* Secondary line with speed and ETA */}
          {(progressDetails.speed || progressDetails.eta) && (
            <div className="sync-progress-secondary">
              {progressDetails.speed && <span>{progressDetails.speed}</span>}
              {progressDetails.speed && progressDetails.eta && <span> · </span>}
              {progressDetails.eta && <span>{formatEta(progressDetails.eta)}</span>}
            </div>
          )}
        </div>
      )}

      {/* Indeterminate progress message when archiving but no progress data yet */}
      {isActive && !progressDetails && state === 'archiving' && (
        <div className="sync-details">
          <div className="sync-progress-main">
            Preparing...
          </div>
        </div>
      )}

      {/* Last activity for idle state */}
      {!isActive && lastActivity && (
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
