import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import tailwindcss from '@tailwindcss/vite';
import pkg from './package.json' with { type: 'json' };

export default defineConfig({
  plugins: [preact(), tailwindcss()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  build: {
    outDir: 'dist',
    // Use esbuild for minification (faster, no extra dependency)
    minify: 'esbuild',
    // Target older browsers for maximum compatibility
    target: 'es2018',
    // Generate smaller chunks for Raspberry Pi
    rollupOptions: {
      output: {
        manualChunks: undefined,
      },
    },
  },
  // Base path for deployment - use relative paths by default for flexibility
  base: './',
});
