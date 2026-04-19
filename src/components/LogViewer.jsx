import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { useLogTail } from '../hooks/useLogTail';
import { generateDiagnostics, fetchDiagnostics } from '../services/api';
import {
  TerminalIcon,
  RefreshIcon,
  DownloadIcon,
  TrashIcon,
  InfoIcon,
  FileTextIcon,
} from './Icons';
import { EmptyState } from './EmptyState';

// Log types
const LOG_TYPES = {
  archiveloop: {
    label: 'Archive Log',
    file: 'archiveloop.log',
    description: 'Sync and archive operations',
  },
  setup: {
    label: 'Setup Log',
    file: 'teslausb-headless-setup.log',
    description: 'Initial setup and configuration',
  },
  diagnostics: {
    label: 'Diagnostics',
    file: 'diagnostics.txt',
    description: 'System diagnostics report',
  },
};

export function LogViewer() {
  const [activeLog, setActiveLog] = useState('archiveloop');
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const [diagnosticsContent, setDiagnosticsContent] = useState(null);
  const logContainerRef = useRef(null);

  // Use log tailing hook for archive and setup logs
  const isRegularLog = activeLog !== 'diagnostics';
  const { lines, loading, error, refresh, clear } = useLogTail(
    isRegularLog ? LOG_TYPES[activeLog].file : '',
    2000,
    isRegularLog
  );

  // Auto-scroll to bottom
  useEffect(() => {
    if (logContainerRef.current && isRegularLog) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [lines, isRegularLog]);

  // Generate and load diagnostics
  const handleGenerateDiagnostics = useCallback(async () => {
    setDiagnosticsLoading(true);
    setDiagnosticsContent(null);
    try {
      await generateDiagnostics();
      const content = await fetchDiagnostics();
      setDiagnosticsContent(content);
    } catch (e) {
      setDiagnosticsContent(`Error generating diagnostics: ${e.message}`);
    } finally {
      setDiagnosticsLoading(false);
    }
  }, []);

  // Load diagnostics when tab is selected
  useEffect(() => {
    if (activeLog === 'diagnostics' && !diagnosticsContent) {
      handleGenerateDiagnostics();
    }
  }, [activeLog, diagnosticsContent, handleGenerateDiagnostics]);

  // Download log file
  const handleDownload = useCallback(() => {
    const content = activeLog === 'diagnostics' ? diagnosticsContent : lines.join('\n');
    const filename = LOG_TYPES[activeLog].file;

    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [activeLog, lines, diagnosticsContent]);

  // Get line class for syntax highlighting
  const getLineClass = (line) => {
    const lower = line.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('fatal')) {
      return 'error';
    }
    if (lower.includes('warning') || lower.includes('warn')) {
      return 'warning';
    }
    if (lower.includes('success') || lower.includes('completed') || lower.includes('finished')) {
      return 'success';
    }
    return '';
  };

  const currentLogInfo = LOG_TYPES[activeLog];
  const displayLines = activeLog === 'diagnostics' ? diagnosticsContent?.split('\n') || [] : lines;

  return (
    <div className="log-view">
      {/* Log type selector */}
      <div className="log-type-selector">
        {Object.entries(LOG_TYPES).map(([key, log]) => (
          <button
            key={key}
            className={`btn ${activeLog === key ? 'btn-primary' : ''}`}
            onClick={() => setActiveLog(key)}
          >
            {key === 'diagnostics' ? <InfoIcon /> : <TerminalIcon />}
            <span>{log.label}</span>
          </button>
        ))}
      </div>

      {/* Log viewer */}
      <div className="log-viewer log-viewer--flex">
        <div className="log-viewer-header">
          <div className="log-viewer-title">
            {currentLogInfo.label}
            <span className="log-viewer-description">— {currentLogInfo.description}</span>
          </div>
          <div className="log-viewer-actions">
            {activeLog === 'diagnostics' ? (
              <button
                type="button"
                className="btn btn-sm log-action-btn"
                onClick={handleGenerateDiagnostics}
                disabled={diagnosticsLoading}
                aria-label="Regenerate diagnostics"
              >
                <RefreshIcon
                  className={diagnosticsLoading ? 'spinning' : ''}
                  aria-hidden="true"
                />
                <span>Regenerate</span>
              </button>
            ) : (
              <>
                <button
                  type="button"
                  className="btn btn-sm log-action-btn"
                  onClick={refresh}
                  disabled={loading}
                  title="Refresh"
                  aria-label="Refresh log"
                >
                  <RefreshIcon className={loading ? 'spinning' : ''} aria-hidden="true" />
                </button>
                <button
                  type="button"
                  className="btn btn-sm log-action-btn"
                  onClick={clear}
                  title="Clear"
                  aria-label="Clear log"
                >
                  <TrashIcon aria-hidden="true" />
                </button>
              </>
            )}
            <button
              type="button"
              className="btn btn-sm log-action-btn"
              onClick={handleDownload}
              disabled={displayLines.length === 0}
              title="Download"
              aria-label="Download log"
            >
              <DownloadIcon aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="log-viewer-content" ref={logContainerRef}>
          {(loading && displayLines.length === 0) || diagnosticsLoading ? (
            <div className="log-message log-message--info">Loading...</div>
          ) : error ? (
            error.includes('not found') ? (
              <div className="log-message log-message--info">
                Log file not available.{' '}
                {activeLog === 'setup' && 'The setup log is only present during initial setup.'}
              </div>
            ) : (
              <div className="log-message log-message--error">Error: {error}</div>
            )
          ) : displayLines.length === 0 ? (
            <EmptyState
              icon={FileTextIcon}
              title="Log is empty"
              subtitle="No activity has been written yet."
              tone="neutral"
            />
          ) : (
            displayLines.map((line, idx) => (
              <div key={idx} className={`log-line ${getLineClass(line)}`}>
                {line}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Log stats */}
      {isRegularLog && lines.length > 0 && (
        <div className="log-stats">
          <span>{lines.length} lines</span>
          <span>Auto-refreshing every 2s</span>
        </div>
      )}
    </div>
  );
}

export default LogViewer;
