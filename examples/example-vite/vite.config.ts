import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sqlitePromiserDevPlugin } from 'sqlite-promiser/vite';

export default defineConfig({
  plugins: [react(), sqlitePromiserDevPlugin()],
  // Pre-bundling breaks sqlite's worker + wasm URL resolution.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  server: {
    strictPort: true,
    port: Number(process.env.PORT ?? 5173)
  },
  preview: {
    strictPort: true,
    port: Number(process.env.PORT ?? 5173)
  }
});
