import { useState, useEffect, useRef, useCallback } from 'preact/hooks';
import { fetchVideoList, fetchEventData, getVideoUrl } from '../services/api';
import {
  PlayIcon,
  PauseIcon,
  SkipBackIcon,
  SkipForwardIcon,
  LayoutIcon,
  MapPinIcon,
  ChevronDownIcon,
} from './Icons';

// Camera angles in Tesla vehicles
const CAMERAS = {
  front: 'Front',
  back: 'Back',
  left_repeater: 'Left Repeater',
  right_repeater: 'Right Repeater',
  left_pillar: 'Left Pillar',
  right_pillar: 'Right Pillar',
};

// Layout configurations
const LAYOUTS = [
  { id: '6', name: 'All Cameras', cameras: Object.keys(CAMERAS), cols: 3 },
  { id: '4-front', name: 'Front Focus', cameras: ['front', 'left_repeater', 'right_repeater', 'back'], cols: 2 },
  { id: '4-rear', name: 'Rear Focus', cameras: ['back', 'left_repeater', 'right_repeater', 'front'], cols: 2 },
  { id: '2-side', name: 'Side View', cameras: ['left_repeater', 'right_repeater'], cols: 2 },
  { id: '1-front', name: 'Front Only', cameras: ['front'], cols: 1 },
  { id: '1-back', name: 'Rear Only', cameras: ['back'], cols: 1 },
];

export function VideoViewer() {
  const [videoList, setVideoList] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Playback state
  const [selectedCategory, setSelectedCategory] = useState('SentryClips');
  const [selectedSequence, setSelectedSequence] = useState(null);
  const [selectedTimestamp, setSelectedTimestamp] = useState(null); // For RecentClips time selection
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [layout, setLayout] = useState(LAYOUTS[0]);
  const [showLayoutMenu, setShowLayoutMenu] = useState(false);

  // Event data for sentry clips
  const [eventData, setEventData] = useState(null);

  // Video refs for synchronized playback
  const videoRefs = useRef({});
  const masterCamera = useRef(null);

  // Load video list
  useEffect(() => {
    loadVideoList();
  }, []);

  const loadVideoList = async () => {
    try {
      setLoading(true);
      const list = await fetchVideoList();
      setVideoList(list);

      // Select first available sequence
      for (const category of ['SentryClips', 'SavedClips', 'RecentClips']) {
        const sequences = Object.keys(list[category] || {});
        if (sequences.length > 0) {
          setSelectedCategory(category);
          setSelectedSequence(sequences[0]);
          break;
        }
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  // Load event data when sequence changes
  useEffect(() => {
    // Reset master camera when sequence changes
    masterCamera.current = null;
    setCurrentTime(0);
    setDuration(0);

    if (selectedCategory === 'SentryClips' && selectedSequence) {
      fetchEventData(selectedSequence).then(setEventData);
    } else {
      setEventData(null);
    }
  }, [selectedCategory, selectedSequence]);

  // Extract unique timestamps from files (for all clip types with multiple timestamps)
  const getTimestamps = useCallback(() => {
    if (!videoList || !selectedSequence) return [];

    const files = videoList[selectedCategory]?.[selectedSequence] || [];
    const timestamps = new Set();

    for (const file of files) {
      // Extract timestamp: 2025-12-14_14-15-05-front.mp4 -> 2025-12-14_14-15-05
      const match = file.match(/(\d{4}-\d{2}-\d{2}_\d{2}-\d{2}-\d{2})/);
      if (match) {
        timestamps.add(match[1]);
      }
    }

    // Only show time selector if there's more than one timestamp
    const result = Array.from(timestamps).sort().reverse();
    return result.length > 1 ? result : [];
  }, [videoList, selectedCategory, selectedSequence]);

  const timestamps = getTimestamps();

  // Auto-select most recent timestamp when timestamps change
  useEffect(() => {
    if (timestamps.length > 0 && !selectedTimestamp) {
      setSelectedTimestamp(timestamps[0]);
    }
  }, [timestamps, selectedTimestamp]);

  // Get video files for current sequence
  const getVideoFiles = useCallback(() => {
    if (!videoList || !selectedSequence) return {};

    const files = videoList[selectedCategory]?.[selectedSequence] || [];
    const result = {};

    // Only filter by timestamp when there are multiple timestamps to choose from
    const filterTimestamp = timestamps.length > 0 ? selectedTimestamp : null;

    for (const file of files) {
      // If filtering by timestamp, skip files that don't match
      if (filterTimestamp && !file.startsWith(filterTimestamp)) {
        continue;
      }

      // Extract camera from filename: 2025-01-15_12-30-45-front.mp4
      for (const camera of Object.keys(CAMERAS)) {
        if (file.includes(`-${camera}.mp4`) || file.includes(`_${camera}.mp4`)) {
          result[camera] = getVideoUrl(selectedCategory, selectedSequence, file);
          break;
        }
      }
    }

    return result;
  }, [videoList, selectedCategory, selectedSequence, selectedTimestamp, timestamps]);

  const videoFiles = getVideoFiles();

  // Synchronized playback controls
  const playAll = useCallback(() => {
    Object.values(videoRefs.current).forEach(video => {
      if (video) video.play();
    });
    setPlaying(true);
  }, []);

  const pauseAll = useCallback(() => {
    Object.values(videoRefs.current).forEach(video => {
      if (video) video.pause();
    });
    setPlaying(false);
  }, []);

  const seekAll = useCallback((time) => {
    Object.values(videoRefs.current).forEach(video => {
      if (video) video.currentTime = time;
    });
    setCurrentTime(time);
  }, []);

  const skipBack = useCallback(() => {
    seekAll(Math.max(0, currentTime - 10));
  }, [currentTime, seekAll]);

  const skipForward = useCallback(() => {
    seekAll(Math.min(duration, currentTime + 30));
  }, [currentTime, duration, seekAll]);

  // Handle time updates from videos - only use master camera to avoid jumping
  const handleTimeUpdate = useCallback((camera) => (e) => {
    if (camera === masterCamera.current) {
      setCurrentTime(e.target.currentTime);
    }
  }, []);

  const handleDurationChange = useCallback((camera) => (e) => {
    const dur = e.target.duration;
    // Only accept valid, finite durations
    if (dur && dur !== Infinity && !isNaN(dur)) {
      // Set master camera when we first get a valid duration
      if (!masterCamera.current) {
        masterCamera.current = camera;
      }
      // Only update duration from master camera
      if (camera === masterCamera.current) {
        setDuration(dur);
      }
    }
  }, []);

  // Handle timeline click
  const handleTimelineClick = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const percent = (e.clientX - rect.left) / rect.width;
    const time = percent * duration;
    seekAll(time);
  }, [duration, seekAll]);

  // Format time display
  const formatTime = (seconds) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Get sequences for category dropdown
  const sequences = videoList?.[selectedCategory] ? Object.keys(videoList[selectedCategory]).sort().reverse() : [];

  if (loading) {
    return (
      <div className="video-viewer" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="text-muted">Loading recordings...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-viewer" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <span className="status-unhealthy">Error: {error}</span>
        <button className="btn" onClick={loadVideoList} style={{ marginTop: '1rem' }}>
          Retry
        </button>
      </div>
    );
  }

  const hasVideos = selectedSequence && Object.keys(videoFiles).length > 0;

  return (
    <div className="video-viewer">
      {/* Clip selector bar - always visible so users can switch categories */}
      <div className="video-selector" style={{
        display: 'flex',
        gap: '0.5rem',
        padding: '8px 12px',
        background: '#1a1a1a',
        borderBottom: '1px solid #333',
        alignItems: 'center',
        flexWrap: 'wrap',
      }}>
        {/* Category selector */}
        <select
          value={selectedCategory}
          onChange={(e) => {
            setSelectedCategory(e.target.value);
            const seqs = Object.keys(videoList[e.target.value] || {});
            setSelectedSequence(seqs[0] || null);
            setSelectedTimestamp(null); // Reset timestamp when category changes
          }}
          style={{
            background: '#333',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '13px',
          }}
        >
          <option value="SentryClips">Sentry Clips</option>
          <option value="SavedClips">Saved Clips</option>
          <option value="RecentClips">Recent Clips</option>
        </select>

        {/* Sequence selector */}
        <select
          value={selectedSequence || ''}
          onChange={(e) => {
            setSelectedSequence(e.target.value);
            setSelectedTimestamp(null); // Reset timestamp when date changes
          }}
          style={{
            background: '#333',
            color: '#fff',
            border: '1px solid #444',
            borderRadius: '4px',
            padding: '6px 10px',
            fontSize: '13px',
            flex: 1,
            maxWidth: '180px',
          }}
        >
          {sequences.map(seq => (
            <option key={seq} value={seq}>{formatSequenceName(seq)}</option>
          ))}
        </select>

        {/* Timestamp selector (when multiple timestamps exist in a folder) */}
        {timestamps.length > 0 && (
          <select
            value={selectedTimestamp || ''}
            onChange={(e) => setSelectedTimestamp(e.target.value)}
            style={{
              background: '#333',
              color: '#fff',
              border: '1px solid #444',
              borderRadius: '4px',
              padding: '6px 10px',
              fontSize: '13px',
              maxWidth: '120px',
            }}
          >
            {timestamps.map(ts => (
              <option key={ts} value={ts}>{formatTimestamp(ts)}</option>
            ))}
          </select>
        )}

        {/* Layout selector */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-sm btn-dark"
            onClick={() => setShowLayoutMenu(!showLayoutMenu)}
          >
            <LayoutIcon />
            <span>{layout.name}</span>
            <ChevronDownIcon />
          </button>
          {showLayoutMenu && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              background: '#2a2a2a',
              border: '1px solid #444',
              borderRadius: '6px',
              marginTop: '4px',
              zIndex: 100,
              minWidth: '150px',
            }}>
              {LAYOUTS.map(l => (
                <button
                  key={l.id}
                  onClick={() => {
                    setLayout(l);
                    setShowLayoutMenu(false);
                  }}
                  style={{
                    display: 'block',
                    width: '100%',
                    padding: '8px 12px',
                    background: layout.id === l.id ? '#0095f6' : 'transparent',
                    color: '#fff',
                    border: 'none',
                    textAlign: 'left',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  {l.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Event location info */}
        {eventData && eventData.city && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#888', fontSize: '12px', marginLeft: 'auto' }}>
            <MapPinIcon style={{ width: 14, height: 14 }} />
            <span>{eventData.city}</span>
          </div>
        )}
      </div>

      {/* Video grid or empty state */}
      {hasVideos ? (
        <>
          <div
            className={`video-grid layout-${layout.cameras.length}`}
            style={{
              gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
            }}
          >
            {layout.cameras.map(camera => (
                <div key={camera} className="video-cell">
                  {videoFiles[camera] ? (
                    <video
                      ref={el => { videoRefs.current[camera] = el; }}
                      src={videoFiles[camera]}
                      onTimeUpdate={handleTimeUpdate(camera)}
                      onDurationChange={handleDurationChange(camera)}
                      onEnded={pauseAll}
                      muted
                      playsInline
                    />
                  ) : (
                    <div style={{ color: '#666', fontSize: '12px' }}>No video</div>
                  )}
                  <div className="video-cell-label">{CAMERAS[camera]}</div>
                </div>
            ))}
          </div>

          {/* Video controls */}
          <div className="video-controls">
            <button className="btn btn-sm" onClick={skipBack} title="Skip back 10s">
              <SkipBackIcon />
            </button>

            <button className="video-play-btn" onClick={playing ? pauseAll : playAll}>
              {playing ? <PauseIcon /> : <PlayIcon />}
            </button>

            <button className="btn btn-sm" onClick={skipForward} title="Skip forward 30s">
              <SkipForwardIcon />
            </button>

            <div className="video-time">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>

            <div className="video-timeline" onClick={handleTimelineClick}>
              <div
                className="video-timeline-progress"
                style={{ width: duration > 0 ? `${(currentTime / duration) * 100}%` : '0%' }}
              />
            </div>
          </div>
        </>
      ) : (
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#888',
          fontSize: '14px'
        }}>
          No recordings in {selectedCategory === 'SentryClips' ? 'Sentry Clips' :
                           selectedCategory === 'SavedClips' ? 'Saved Clips' : 'Recent Clips'}
        </div>
      )}
    </div>
  );
}

// Format sequence name (date/time folder) to readable string
function formatSequenceName(sequence) {
  // Format: 2025-01-15_12-30-45 or 2025-01-15
  const match = sequence.match(/(\d{4})-(\d{2})-(\d{2})(?:_(\d{2})-(\d{2})-(\d{2}))?/);
  if (match) {
    const [, year, month, day, hour, min, sec] = match;
    const date = new Date(year, month - 1, day, hour || 0, min || 0, sec || 0);
    if (hour) {
      return date.toLocaleString([], {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }
  return sequence;
}

// Format timestamp to just show time (HH:MM)
function formatTimestamp(timestamp) {
  // Format: 2025-12-14_14-15-05 -> 2:15 PM
  const match = timestamp.match(/\d{4}-\d{2}-\d{2}_(\d{2})-(\d{2})-(\d{2})/);
  if (match) {
    const [, hour, min] = match;
    const date = new Date(2000, 0, 1, parseInt(hour), parseInt(min));
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }
  return timestamp;
}

export default VideoViewer;
