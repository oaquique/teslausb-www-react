import { useState, useCallback, useMemo } from 'preact/hooks';
import { useLogTail, parseSyncStatus } from '../hooks/useLogTail';
import { useMusicSyncProgress } from '../hooks/useMusicSyncProgress';
import { triggerSync } from '../services/api';
import {
  CameraIcon,
  MusicIcon,
  HardDriveIcon,
  BluetoothIcon,
} from './Icons';
import { StorageBar } from './StorageBar';
import { SyncStatus } from './SyncStatus';

export function Dashboard({ status, computed, config, storage, onRefresh }) {
  const [syncLoading, setSyncLoading] = useState(false);

  // Tail archiveloop log for sync status
  const { lines: logLines } = useLogTail('archiveloop.log', 3000, true);
  const syncStatus = parseSyncStatus(logLines);

  // Check if music sync is active (for enabling progress polling)
  const isMusicSyncActive = useMemo(() => {
    return syncStatus.state === 'archiving' &&
           syncStatus.message?.toLowerCase().includes('music');
  }, [syncStatus.state, syncStatus.message]);

  // Poll music sync progress when music sync is active
  const musicProgress = useMusicSyncProgress(isMusicSyncActive, 1500);

  const handleTriggerSync = useCallback(async () => {
    setSyncLoading(true);
    try {
      await triggerSync();
      setTimeout(onRefresh, 1000);
    } catch (e) {
      console.error('Trigger sync failed:', e);
    } finally {
      setSyncLoading(false);
    }
  }, [onRefresh]);

  // Feature status items for compact display
  const features = [
    { key: 'cam', label: 'TeslaCam', icon: CameraIcon, enabled: config?.has_cam === 'yes' },
    { key: 'music', label: 'Music', icon: MusicIcon, enabled: config?.has_music === 'yes' },
    { key: 'lightshow', label: 'LightShow', icon: HardDriveIcon, enabled: config?.has_lightshow === 'yes' },
    { key: 'boombox', label: 'Boombox', icon: HardDriveIcon, enabled: config?.has_boombox === 'yes' },
  ];

  // Only show BLE if configured
  if (config?.uses_ble === 'yes') {
    features.push({ key: 'ble', label: 'BLE', icon: BluetoothIcon, enabled: true });
  }

  return (
    <div className="dashboard-content">
      {/* Configured Features */}
      <div className="dashboard-section">
        <div className="section-title">Configured Features</div>
        <div className="features-row">
          {features.map(({ key, label, enabled }) => (
            <div key={key} className={`feature-badge ${enabled ? 'enabled' : 'disabled'}`}>
              {label}
            </div>
          ))}
        </div>
      </div>

      {/* Storage Visualization */}
      <div className="dashboard-section">
        <div className="card">
          <div className="card-header">
            <span className="card-title">Storage</span>
            <span className="card-value">{computed?.diskTotalGB || '0'} GB</span>
          </div>
          <StorageBar
            storage={storage}
            total={status?.total_space ? parseInt(status.total_space, 10) : 0}
            free={status?.free_space ? parseInt(status.free_space, 10) : 0}
            config={config}
          />
        </div>
      </div>

      {/* Sync Status */}
      <div className="dashboard-section">
        <SyncStatus
          syncStatus={syncStatus}
          onTriggerSync={handleTriggerSync}
          loading={syncLoading}
          musicProgress={musicProgress}
        />
      </div>
    </div>
  );
}

export default Dashboard;
