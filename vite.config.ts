import { defineConfig } from 'vite';

export default defineConfig({
  // Relative paths so `dist/` works when served from any folder.
  base: './',
  build: {
    // Phaser is one big (~1.5 MB) module; that's expected.
    chunkSizeWarningLimit: 2500,
  },
});
