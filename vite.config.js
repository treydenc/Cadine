// vite.config.js
import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    open: true
  },
  optimizeDeps: {
    include: ['tweakpane', 'gpu-io']
  }
});