import { useState, useEffect, useCallback, useRef } from 'preact/hooks';
import { fetchLog } from '../services/api';

/**
 * Hook for tailing log files with efficient range requests
 * @param {string} logFile - Log file path (e.g., 'archiveloop.log')
 * @param {number} pollInterval - Polling interval in ms (default 2000)
 * @param {boolean} enabled - Whether to enable polling
 * @returns {Object} Log content, sync state, and control functions
 */
export function useLogTail(logFile, pollInterval = 2000, enabled = true) {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const lastSizeRef = useRef(0);
  const autoScrollRef = useRef(true);
  const logFileRef = useRef(logFile);

  const refresh = useCallback(async (reset = false) => {
    if (!logFile) return;

    try {
      if (reset) {
        lastSizeRef.current = 0;
      }

      const result = await fetchLog(logFile, lastSizeRef.current);

      if (result.truncated) {
        // Log was truncated, start fresh
        lastSizeRef.current = 0;
        setLines([]);
        return;
      }

      if (result.content) {
        const newLines = result.content.split('\n').filter(Boolean);
        if (reset) {
          setLines(newLines.slice(-1000));
        } else {
          setLines(prev => [...prev, ...newLines].slice(-1000)); // Keep last 1000 lines
        }
      }

      lastSizeRef.current = result.size;
      setError(null);
    } catch (e) {
      // Only set error, don't clear lines on error
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [logFile]);

  // Reset when log file changes
  useEffect(() => {
    if (logFile !== logFileRef.current) {
      logFileRef.current = logFile;
      lastSizeRef.current = 0;
      setLines([]);
      setLoading(true);
      setError(null);
    }
  }, [logFile]);

  useEffect(() => {
    if (!enabled || !logFile) return;

    refresh(true); // Initial load
    const interval = setInterval(() => refresh(false), pollInterval);
    return () => clearInterval(interval);
  }, [logFile, pollInterval, enabled]); // Don't depend on refresh to avoid recreation

  const setAutoScroll = useCallback((value) => {
    autoScrollRef.current = value;
  }, []);

  const clear = useCallback(() => {
    setLines([]);
    lastSizeRef.current = 0;
  }, []);

  return {
    lines,
    loading,
    error,
    autoScroll: autoScrollRef.current,
    setAutoScroll,
    refresh: () => refresh(false),
    clear,
  };
}

/**
 * Parse archiveloop.log to extract sync status
 * @param {string[]} lines - Log lines
 * @returns {Object} Sync status object
 */
export function parseSyncStatus(lines) {
  const status = {
    state: 'idle', // idle, connecting, archiving, complete, error
    totalFiles: 0,
    archivedFiles: 0,
    currentFile: null,
    startTime: null,
    elapsedTime: null,
    lastActivity: null,
    message: null,
  };

  if (!lines || lines.length === 0) {
    return status;
  }

  // Parse from most recent lines backwards to find current state
  const recentLines = lines.slice(-100);

  // Always extract timestamp from most recent line first
  if (recentLines.length > 0) {
    status.lastActivity = extractTimestamp(recentLines[recentLines.length - 1]);
  }

  // First pass: look for file counts and completion messages
  for (let i = recentLines.length - 1; i >= 0; i--) {
    const line = recentLines[i];

    // File count before archiving: "There are X event folder(s) with Y file(s) and Z track mode file(s)"
    const fileCountMatch = line.match(/There are (\d+) event folder\(s\) with (\d+) file\(s\)(?: and (\d+) track mode file\(s\))?/);
    if (fileCountMatch) {
      const sentryFiles = parseInt(fileCountMatch[2], 10);
      const trackModeFiles = fileCountMatch[3] ? parseInt(fileCountMatch[3], 10) : 0;
      status.totalFiles = sentryFiles + trackModeFiles;
      break; // Found the count for this archive session
    }

    // Archiving message with count: "Archiving X file(s) including Y event folder(s)"
    const archivingMatch = line.match(/Archiving (\d+)(?: track mode)? file\(s\)/);
    if (archivingMatch && !line.includes('completed')) {
      status.totalFiles = parseInt(archivingMatch[1], 10);
    }
  }

  // Check if music sync is in progress (started but not finished)
  // This needs to be detected first because snapshot/idle messages can appear during music sync
  let musicSyncActive = false;
  for (let i = recentLines.length - 1; i >= 0; i--) {
    const line = recentLines[i];
    if (line.includes('Finished copying music') || line.includes('Copying music failed')) {
      // Music sync completed, not active
      break;
    }
    if (line.includes('Syncing music from archive') || line.includes('Starting music sync')) {
      // Music sync started and not yet finished
      musicSyncActive = true;
      break;
    }
    // If we hit "Connected usb to host" or "Waiting for archive to be unreachable",
    // we're in a new cycle - no active music sync
    if (line.includes('Connected usb to host') || line.includes('Waiting for archive to be unreachable')) {
      break;
    }
  }

  // If music sync is active, show that status
  if (musicSyncActive) {
    status.state = 'archiving';
    status.message = 'Syncing music...';
    return status;
  }

  // Second pass: determine current state
  for (let i = recentLines.length - 1; i >= 0; i--) {
    const line = recentLines[i];

    // Archiving completed successfully
    if (line.includes('Archiving completed successfully')) {
      status.state = 'complete';
      status.message = 'Archive completed';
      break;
    }

    // Finished copying music
    if (line.includes('Finished copying music')) {
      status.state = 'complete';
      status.message = 'Music sync complete';
      break;
    }

    // Completion message with stats: "Copied X music file(s)"
    if (line.includes('Copied') && line.includes('file(s)')) {
      const match = line.match(/Copied (\d+)/);
      if (match) {
        status.state = 'complete';
        status.archivedFiles = parseInt(match[1], 10);
        status.message = `Copied ${status.archivedFiles} files`;
        break;
      }
    }

    // Starting recording archiving
    if (line.includes('Starting recording archiving')) {
      status.state = 'archiving';
      status.message = status.totalFiles > 0
        ? `Archiving ${status.totalFiles} files...`
        : 'Archiving recordings...';
      break;
    }

    // Currently archiving (fallback)
    if (line.includes('Archiving...')) {
      status.state = 'archiving';
      status.message = status.totalFiles > 0
        ? `Archiving ${status.totalFiles} files...`
        : 'Archiving files...';
      break;
    }

    // Syncing music (fallback if musicSyncActive didn't catch it)
    if (line.includes('Syncing music from archive')) {
      status.state = 'archiving';
      status.message = 'Syncing music...';
      break;
    }

    // Copying music
    if (line.includes('Copying music')) {
      status.state = 'archiving';
      status.message = 'Copying music...';
      break;
    }

    // Finished archiving
    if (line.includes('Finished archiving')) {
      status.state = 'complete';
      status.message = 'Archive complete';
      break;
    }

    // Running fsck
    if (line.includes('Running fsck')) {
      status.state = 'archiving';
      status.message = 'Checking filesystem...';
      break;
    }

    // Checking folder count
    if (line.includes('Checking saved folder count')) {
      status.state = 'archiving';
      status.message = 'Scanning files...';
      break;
    }

    // Waiting for archive to be reachable (connecting)
    if (line.includes('Waiting for archive to be reachable')) {
      status.state = 'connecting';
      status.message = 'Connecting to archive server...';
      break;
    }

    // Archive is reachable
    if (line.includes('Archive is reachable')) {
      status.state = 'archiving';
      status.message = 'Connected, preparing...';
      break;
    }

    // Disconnecting USB (preparing to archive)
    if (line.includes('Disconnecting usb from host')) {
      status.state = 'archiving';
      status.message = 'Disconnecting from vehicle...';
      break;
    }

    // Connected to host (idle)
    if (line.includes('Connected usb to host')) {
      status.state = 'idle';
      status.message = 'Connected to vehicle';
      break;
    }

    // Waiting for archive to be unreachable (idle, connected to car)
    if (line.includes('Waiting for archive to be unreachable')) {
      status.state = 'idle';
      status.message = 'Connected to vehicle';
      break;
    }

    // Taking snapshot or snapshot-related messages
    if (line.includes('snapshot')) {
      status.state = 'idle';
      status.message = 'Managing snapshots...';
      break;
    }

    // Low space cleanup
    if (line.includes('low space, deleting')) {
      status.state = 'idle';
      status.message = 'Cleaning up old snapshots...';
      break;
    }

    // Waiting for idle interval
    if (line.includes('waiting up to') && line.includes('idle interval')) {
      status.state = 'idle';
      status.message = 'Waiting for idle...';
      break;
    }

    // Mass storage process check
    if (line.includes('mass storage process')) {
      status.state = 'idle';
      status.message = 'Ready';
      break;
    }

    // Check for errors
    if (line.includes('error') || line.includes('failed')) {
      // Only set error if it's a significant error, not just "sntp failed"
      if (!line.includes('sntp failed')) {
        status.state = 'error';
        status.message = 'Error occurred';
        break;
      }
    }
  }

  return status;
}

/**
 * Extract timestamp from log line
 * @param {string} line - Log line
 * @returns {Date|null} Parsed date or null
 */
function extractTimestamp(line) {
  // Format: "Tue  9 Dec 13:22:02 PST 2025:" or "Wed 27 Aug 20:14:11 PDT 2025:"
  const match = line.match(/^([A-Z][a-z]{2}\s+\d+\s+[A-Z][a-z]{2}\s+\d+:\d+:\d+\s+\w+\s+\d+):/);
  if (match) {
    const date = new Date(match[1]);
    if (!isNaN(date.getTime())) {
      return date;
    }
  }
  return null;
}

export default useLogTail;
