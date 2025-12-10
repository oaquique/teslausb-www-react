/**
 * TeslaUSB API Service
 * Handles all communication with the backend CGI scripts
 */

const API_BASE = '/cgi-bin';

/**
 * Fetch system status
 * @returns {Promise<Object>} Status object with cpu_temp, disk space, wifi, etc.
 */
export async function fetchStatus() {
  const response = await fetch(`${API_BASE}/status.sh`);
  if (!response.ok) throw new Error('Failed to fetch status');
  return response.json();
}

/**
 * Fetch system configuration
 * @returns {Promise<Object>} Config object with has_cam, has_music, etc.
 */
export async function fetchConfig() {
  const response = await fetch(`${API_BASE}/config.sh`);
  if (!response.ok) throw new Error('Failed to fetch config');
  return response.json();
}

/**
 * Fetch per-drive storage information
 * @returns {Promise<Object>} Storage object with cam, music, lightshow, boombox, total
 */
export async function fetchStorage() {
  const response = await fetch(`${API_BASE}/storage.sh`);
  if (!response.ok) throw new Error('Failed to fetch storage');
  return response.json();
}

/**
 * List directory contents
 * @param {string} rootPath - Root path (e.g., /mnt/music)
 * @param {string} dirPath - Directory path relative to root
 * @returns {Promise<Object>} Parsed directory listing
 */
export async function listDirectory(rootPath, dirPath = '') {
  const params = new URLSearchParams();
  params.append('root', rootPath);
  if (dirPath) params.append('path', dirPath);

  const response = await fetch(`${API_BASE}/ls.sh?${encodeURIComponent(rootPath)}&${encodeURIComponent(dirPath)}`);
  if (!response.ok) throw new Error('Failed to list directory');

  const text = await response.text();
  return parseDirectoryListing(text);
}

/**
 * Parse directory listing from ls.sh output
 * @param {string} text - Raw text output
 * @returns {Object} Parsed listing with directories, files, and storage stats
 */
function parseDirectoryListing(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  const result = {
    directories: [],
    files: [],
    storage: null,
  };

  for (const line of lines) {
    if (line.startsWith('d:')) {
      result.directories.push({ name: line.slice(2), depth: 1 });
    } else if (line.startsWith('D:')) {
      result.directories.push({ name: line.slice(2), depth: 2 });
    } else if (line.startsWith('f:')) {
      const parts = line.slice(2).split(':');
      const size = parseInt(parts.pop(), 10);
      const path = parts.join(':');
      result.files.push({ path, size });
    } else if (line.startsWith('s:')) {
      const [, free, total] = line.split(':');
      result.storage = {
        free: parseInt(free, 10),
        total: parseInt(total, 10),
      };
    }
  }

  return result;
}

/**
 * Upload a file
 * @param {string} rootPath - Root path
 * @param {string} destPath - Destination path
 * @param {File} file - File to upload
 * @param {Function} onProgress - Progress callback (0-100)
 * @returns {Promise<void>}
 */
export async function uploadFile(rootPath, destPath, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/upload.sh?${encodeURIComponent(rootPath)}&${encodeURIComponent(destPath)}`);
    xhr.setRequestHeader('Content-Type', 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      if (xhr.status === 200) {
        resolve();
      } else {
        reject(new Error(`Upload failed: ${xhr.status}`));
      }
    };

    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });
}

/**
 * Download a file
 * @param {string} rootPath - Root path
 * @param {string} filePath - File path
 * @returns {string} Download URL
 */
export function getDownloadUrl(rootPath, filePath) {
  return `${API_BASE}/download.sh?${encodeURIComponent(rootPath)}&${encodeURIComponent(filePath)}`;
}

/**
 * Download multiple files as ZIP
 * @param {string} rootPath - Root path
 * @param {string[]} paths - Array of file paths
 * @returns {string} Download URL
 */
export function getZipDownloadUrl(rootPath, paths) {
  const params = [encodeURIComponent(rootPath), ...paths.map(p => encodeURIComponent(p))].join('&');
  return `${API_BASE}/downloadzip.sh?${params}`;
}

/**
 * Create a directory
 * @param {string} rootPath - Root path
 * @param {string} dirName - Directory name to create
 * @returns {Promise<void>}
 */
export async function createDirectory(rootPath, dirName) {
  const response = await fetch(`${API_BASE}/mkdir.sh?${encodeURIComponent(rootPath)}&${encodeURIComponent(dirName)}`);
  if (!response.ok) throw new Error('Failed to create directory');
}

/**
 * Move/Rename a file or directory
 * @param {string} rootPath - Root path
 * @param {string} currentPath - Current path
 * @param {string} newName - New name
 * @returns {Promise<void>}
 */
export async function moveItem(rootPath, currentPath, newName) {
  const response = await fetch(`${API_BASE}/mv.sh?${encodeURIComponent(rootPath)}&${encodeURIComponent(currentPath)}&${encodeURIComponent(newName)}`);
  if (!response.ok) throw new Error('Failed to move/rename item');
}

/**
 * Delete files or directories
 * @param {string} rootPath - Root path
 * @param {string[]} paths - Paths to delete
 * @returns {Promise<void>}
 */
export async function deleteItems(rootPath, paths) {
  const params = [encodeURIComponent(rootPath), ...paths.map(p => encodeURIComponent(p))].join('&');
  const response = await fetch(`${API_BASE}/rm.sh?${params}`);
  if (!response.ok) throw new Error('Failed to delete items');
}

/**
 * Copy a file (used for lock chime)
 * @param {string} rootPath - Root path
 * @param {string} sourcePath - Source file path
 * @param {string} destName - Destination name
 * @returns {Promise<void>}
 */
export async function copyFile(rootPath, sourcePath, destName) {
  const response = await fetch(`${API_BASE}/cp.sh?${encodeURIComponent(rootPath)}&${encodeURIComponent(sourcePath)}&${encodeURIComponent(destName)}`);
  if (!response.ok) throw new Error('Failed to copy file');
}

/**
 * Fetch video list
 * @returns {Promise<Object>} Organized video list by category
 */
export async function fetchVideoList() {
  const response = await fetch(`${API_BASE}/videolist.sh`);
  if (!response.ok) throw new Error('Failed to fetch video list');

  const text = await response.text();
  return parseVideoList(text);
}

/**
 * Parse video list into organized structure
 * @param {string} text - Raw video list text
 * @returns {Object} Organized by category > date > files
 */
function parseVideoList(text) {
  const lines = text.trim().split('\n').filter(Boolean);
  const result = {
    RecentClips: {},
    SavedClips: {},
    SentryClips: {},
  };

  for (const line of lines) {
    const parts = line.split('/');
    if (parts.length >= 2) {
      const [category, ...rest] = parts;
      if (result[category]) {
        const dateOrFile = rest[0];
        if (!result[category][dateOrFile]) {
          result[category][dateOrFile] = [];
        }
        if (rest.length > 1) {
          result[category][dateOrFile].push(rest.slice(1).join('/'));
        }
      }
    }
  }

  return result;
}

/**
 * Trigger sync operation
 * @returns {Promise<void>}
 */
export async function triggerSync() {
  const response = await fetch(`${API_BASE}/trigger_sync.sh`);
  if (!response.ok) throw new Error('Failed to trigger sync');
}

/**
 * Toggle USB drives visibility
 * @returns {Promise<void>}
 */
export async function toggleDrives() {
  const response = await fetch(`${API_BASE}/toggledrives.sh`);
  if (!response.ok) throw new Error('Failed to toggle drives');
}

/**
 * Reboot the system
 * @returns {Promise<void>}
 */
export async function reboot() {
  const response = await fetch(`${API_BASE}/reboot.sh`);
  if (!response.ok) throw new Error('Failed to reboot');
}

/**
 * Start BLE pairing
 * @returns {Promise<boolean>} True if pairing initiated
 */
export async function startBLEPairing() {
  const response = await fetch(`${API_BASE}/pairBLEkey.sh`);
  return response.status === 202;
}

/**
 * Check BLE pairing status
 * @returns {Promise<boolean>} True if paired
 */
export async function checkBLEStatus() {
  const response = await fetch(`${API_BASE}/checkBLEstatus.sh`);
  const text = await response.text();
  return text.includes('<p>paired</p>');
}

/**
 * Generate diagnostics
 * @returns {Promise<void>}
 */
export async function generateDiagnostics() {
  await fetch(`${API_BASE}/diagnose.sh`);
}

/**
 * Fetch diagnostics file
 * @returns {Promise<string>} Diagnostics content
 */
export async function fetchDiagnostics() {
  const response = await fetch('/diagnostics.txt');
  if (!response.ok) throw new Error('Failed to fetch diagnostics');
  return response.text();
}

/**
 * Fetch log file with range support for efficient tailing
 * @param {string} logFile - Log file path
 * @param {number} lastSize - Last known size for range request
 * @returns {Promise<Object>} { content, size, truncated }
 */
export async function fetchLog(logFile, lastSize = 0) {
  const headers = {};
  if (lastSize > 0) {
    headers['Range'] = `bytes=${lastSize}-`;
  }

  const response = await fetch(`/${logFile}`, { headers });

  if (response.status === 416) {
    // Range not satisfiable - log was truncated or no new content
    return { content: '', size: lastSize, truncated: false };
  }

  if (response.status === 404) {
    throw new Error('Log file not found');
  }

  if (!response.ok && response.status !== 206) {
    throw new Error(`Failed to fetch log: ${response.status}`);
  }

  const content = await response.text();

  // For range requests (206), calculate new size from content-range header or content length
  let newSize = lastSize;
  if (response.status === 206) {
    const contentRange = response.headers.get('Content-Range');
    if (contentRange) {
      // Format: bytes start-end/total
      const match = contentRange.match(/bytes \d+-(\d+)\/(\d+)/);
      if (match) {
        newSize = parseInt(match[1], 10) + 1;
      } else {
        newSize = lastSize + content.length;
      }
    } else {
      newSize = lastSize + content.length;
    }
  } else {
    // Full response (200)
    newSize = content.length;
  }

  return {
    content,
    size: newSize,
    truncated: false,
  };
}

/**
 * Run network speed test
 * @param {Function} onProgress - Progress callback with speed in Mbps
 * @param {AbortSignal} signal - Abort signal
 * @returns {Promise<number>} Final speed in Mbps
 */
export async function runSpeedTest(onProgress, signal) {
  const response = await fetch(`${API_BASE}/randomdata.sh`, { signal });
  if (!response.ok) throw new Error('Failed to start speed test');

  const reader = response.body.getReader();
  let totalBytes = 0;
  const startTime = performance.now();

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.length;
      const elapsed = (performance.now() - startTime) / 1000;
      const speedMbps = (totalBytes * 8) / (elapsed * 1000000);

      if (onProgress) {
        onProgress(speedMbps);
      }
    }
  } catch (e) {
    if (e.name !== 'AbortError') throw e;
  }

  const elapsed = (performance.now() - startTime) / 1000;
  return (totalBytes * 8) / (elapsed * 1000000);
}

/**
 * Get video URL for a specific camera angle
 * @param {string} category - RecentClips, SavedClips, or SentryClips
 * @param {string} sequence - Date/time folder
 * @param {string} filename - Video filename
 * @returns {string} Video URL
 */
export function getVideoUrl(category, sequence, filename) {
  return `/TeslaCam/${category}/${sequence}/${filename}`;
}

/**
 * Get event.json URL for sentry events
 * @param {string} sequence - Date/time folder
 * @returns {string} Event JSON URL
 */
export function getEventJsonUrl(sequence) {
  return `/TeslaCam/SentryClips/${sequence}/event.json`;
}

/**
 * Fetch sentry event data
 * @param {string} sequence - Date/time folder
 * @returns {Promise<Object|null>} Event data or null
 */
export async function fetchEventData(sequence) {
  try {
    const response = await fetch(getEventJsonUrl(sequence));
    if (!response.ok) return null;
    return response.json();
  } catch {
    return null;
  }
}
