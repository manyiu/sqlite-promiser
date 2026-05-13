import { copyFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const wasmSrc = path.join(path.dirname(require.resolve('@sqlite.org/sqlite-wasm/package.json')), 'dist', 'sqlite3.wasm');
const wasmDest = path.join(pkgRoot, 'dist', 'sqlite3.wasm');

await copyFile(wasmSrc, wasmDest);
console.log('[copy-sqlite-wasm] dist/sqlite3.wasm');
