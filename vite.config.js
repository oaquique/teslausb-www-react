import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
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
  // Base path for deployment
  base: '/',
});
