/**
 * Storage visualization component
 * Shows per-drive allocation/usage and available free space
 */
export function StorageBar({ storage, total, free, config }) {
  // Format bytes to human readable
  const formatBytes = (bytes) => {
    if (bytes === 0 || bytes === null || bytes === undefined) return '0 B';
    const gb = bytes / (1024 * 1024 * 1024);
    if (gb >= 1) return `${gb.toFixed(1)} GB`;
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const freeBytes = storage?.total?.free || free;

  // Build list of configured drives
  const drives = [];

  const addDrive = (driveData, type, label, configKey) => {
    if (config?.[configKey] !== 'yes' || !driveData) return;

    drives.push({
      type,
      label,
      allocated: driveData.total,
      used: driveData.used,
      mounted: driveData.mounted,
      isCached: driveData.cached || false,
    });
  };

  addDrive(storage?.cam, 'teslacam', 'TeslaCam', 'has_cam');
  addDrive(storage?.music, 'music', 'Music', 'has_music');
  addDrive(storage?.lightshow, 'lightshow', 'LightShow', 'has_lightshow');
  addDrive(storage?.boombox, 'boombox', 'Boombox', 'has_boombox');

  if (drives.length === 0 && !freeBytes) {
    return (
      <div className="storage-bar-container">
        <div className="storage-info">No storage data available</div>
      </div>
    );
  }

  // Calculate total for bar (sum of all allocations + free)
  const totalAllocated = drives.reduce((sum, d) => sum + (d.allocated || 0), 0);
  const barTotal = totalAllocated + freeBytes;

  // Build segments for bar
  const segments = drives.map(drive => ({
    type: drive.type,
    label: drive.label,
    bytes: drive.allocated,
    percent: Math.max(1, Math.round((drive.allocated / barTotal) * 100)),
  }));

  // Add free space segment
  if (freeBytes > 0) {
    segments.push({
      type: 'free',
      label: 'Free',
      bytes: freeBytes,
      percent: Math.max(1, Math.round((freeBytes / barTotal) * 100)),
    });
  }

  return (
    <div className="storage-bar-container">
      {/* Visual bar */}
      <div className="storage-bar">
        {segments.map((seg, idx) => (
          <div
            key={idx}
            className={`storage-segment ${seg.type}`}
            style={{ width: `${seg.percent}%` }}
            title={`${seg.label}: ${formatBytes(seg.bytes)}`}
          />
        ))}
      </div>

      {/* Legend with details */}
      <div className="storage-legend">
        {drives.map((drive, idx) => {
          // Calculate usage percentage within the drive (not allocation percentage)
          const usagePercent = drive.used !== null && drive.allocated > 0
            ? Math.round((drive.used / drive.allocated) * 100)
            : null;
          return (
            <div key={idx} className="storage-legend-item">
              <div className={`storage-legend-dot ${drive.type}`} />
              <span className="storage-legend-label">{drive.label}</span>
              <span className="storage-legend-value">
                {formatBytes(drive.allocated)}
                {drive.used !== null && (
                  <span className="storage-legend-used">
                    {' '}({formatBytes(drive.used)} used{drive.isCached ? '~' : ''}
                    {usagePercent !== null && `, ${usagePercent}%`})
                  </span>
                )}
              </span>
            </div>
          );
        })}
        <div className="storage-legend-item">
          <div className="storage-legend-dot free" />
          <span className="storage-legend-label">Free</span>
          <span className="storage-legend-value">
            {formatBytes(freeBytes)}
          </span>
        </div>
      </div>

      {drives.some(d => d.isCached) && (
        <div className="storage-note">
          ~ Last known (drive not currently mounted)
        </div>
      )}
    </div>
  );
}

export default StorageBar;
