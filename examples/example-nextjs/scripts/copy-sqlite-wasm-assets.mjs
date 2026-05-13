import { copyFile, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = process.cwd();
const publicDir = path.join(root, 'public');
const require = createRequire(import.meta.url);

await mkdir(publicDir, { recursive: true });

// Same layout as published sqlite-promiser/dist (worker resolves OPFS proxy as a sibling URL).
await copyFile(require.resolve('sqlite-promiser/sqlite3.wasm'), path.join(publicDir, 'sqlite3.wasm'));
await copyFile(require.resolve('sqlite-promiser/opfs-async-proxy'), path.join(publicDir, 'sqlite3-opfs-async-proxy.js'));
await copyFile(require.resolve('sqlite-promiser/worker'), path.join(publicDir, 'sqlite-oo1-worker.js'));

console.log('[copy-sqlite-wasm-assets] Copied sqlite3.wasm, sqlite3-opfs-async-proxy.js, sqlite-oo1-worker.js from sqlite-promiser to public/');
