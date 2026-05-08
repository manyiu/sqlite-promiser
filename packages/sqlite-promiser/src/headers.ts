/**
 * Node-safe surface for **header presets + environment probing** (`import 'sqlite-promiser/headers'`).
 *
 * Use with server config (Next.js `headers()`, Vite `server.headers`) so pages can run OPFS-capable clients.
 *
 * @module sqlite-promiser/headers
 */
export { headersPresets } from './headers/headersPresets.js';
export type { HeaderPreset } from './headers/headersPresets.js';
export { describeEnvironment } from './capabilities/describeEnvironment.js';
export type { EnvironmentDescription } from './capabilities/describeEnvironment.js';
