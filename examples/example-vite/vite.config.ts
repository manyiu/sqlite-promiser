import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { headersPresets } from 'sqlite-promiser/headers';

const coop = process.env.VITE_COOP === '1';
const headers = coop ? headersPresets().requireCorp : {};

export default defineConfig({
  plugins: [react()],
  // Pre-bundling breaks sqlite's worker + wasm URL resolution.
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  server: {
    strictPort: true,
    port: Number(process.env.PORT ?? 5173),
    headers
  },
  preview: {
    strictPort: true,
    port: Number(process.env.PORT ?? 5173),
    headers
  }
});
