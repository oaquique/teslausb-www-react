import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * FileBrowser component - wraps the native filebrowser.js
 * Dynamically loads the script and CSS, then initializes the FileBrowser class
 */
export function FileBrowser({ config }) {
  const containerRef = useRef(null);
  const browserRef = useRef(null);
  const [scriptLoaded, setScriptLoaded] = useState(!!window.FileBrowser);

  // Load CSS on mount
  useEffect(() => {
    if (!document.querySelector('link[href="/filebrowser.css"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = '/filebrowser.css';
      document.head.appendChild(link);
    }
  }, []);

  // Load scripts on mount (filebrowser + jsmediatags for ID3 reading)
  useEffect(() => {
    if (!document.querySelector('script[src="/jsmediatags.min.js"]')) {
      const tagScript = document.createElement('script');
      tagScript.src = '/jsmediatags.min.js';
      tagScript.async = true;
      document.head.appendChild(tagScript);
    }

    if (window.FileBrowser) {
      setScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = '/filebrowser.js';
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => console.error('Failed to load filebrowser.js');
    document.head.appendChild(script);
  }, []);

  // Extract config values to use as stable dependencies
  const hasMusic = config?.has_music === 'yes';
  const hasLightshow = config?.has_lightshow === 'yes';
  const hasBoombox = config?.has_boombox === 'yes';

  // Initialize FileBrowser when script is loaded and config is ready
  useEffect(() => {
    if (!scriptLoaded || !containerRef.current) {
      return;
    }

    // Build drives array based on config
    const drives = [];
    if (hasMusic) {
      drives.push({ path: 'fs/Music', label: 'Music' });
    }
    if (hasLightshow) {
      drives.push({ path: 'fs/LightShow', label: 'LightShow' });
    }
    if (hasBoombox) {
      drives.push({ path: 'fs/Boombox', label: 'Boombox' });
    }

    if (drives.length === 0) {
      return;
    }

    // Only initialize once - don't recreate if already exists
    if (browserRef.current) {
      return;
    }

    // Create new FileBrowser instance
    try {
      browserRef.current = new window.FileBrowser(containerRef.current, drives);
    } catch (e) {
      console.error('Failed to initialize FileBrowser:', e);
    }

    // Cleanup on unmount
    return () => {
      if (containerRef.current) {
        containerRef.current.innerHTML = '';
      }
      browserRef.current = null;
    };
  }, [scriptLoaded, hasMusic, hasLightshow, hasBoombox]);

  // Check if any drives are configured
  const hasDrives =
    config?.has_music === 'yes' || config?.has_lightshow === 'yes' || config?.has_boombox === 'yes';

  if (!hasDrives) {
    return (
      <div className="file-browser-state file-browser-state--empty">
        <svg
          className="file-browser-state-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
        >
          <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
        </svg>
        <span>No file drives configured</span>
      </div>
    );
  }

  // Show loading state while script loads
  if (!scriptLoaded) {
    return <div className="file-browser-state file-browser-state--loading">Loading file browser...</div>;
  }

  return <div ref={containerRef} className="file-browser-container" />;
}

export default FileBrowser;
