import { copyFile, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pkgRoot = path.join(__dirname, '..');
const require = createRequire(import.meta.url);
const upstreamDist = path.join(path.dirname(require.resolve('@sqlite.org/sqlite-wasm/package.json')), 'dist');

const wasmSrc = path.join(upstreamDist, 'sqlite3.wasm');
const wasmDest = path.join(pkgRoot, 'dist', 'sqlite3.wasm');
await copyFile(wasmSrc, wasmDest);
console.log('[copy-sqlite-dist-assets] dist/sqlite3.wasm');

const opfsSrc = path.join(upstreamDist, 'sqlite3-opfs-async-proxy.js');
const opfsDest = path.join(pkgRoot, 'dist', 'sqlite3-opfs-async-proxy.js');
await copyFile(opfsSrc, opfsDest);

const legacyMainThreadGuard = 'globalThis.window === globalThis';
const nestedWorkerSafeGuard = 'typeof document !== "undefined"';
let opfsSrcText = await readFile(opfsDest, 'utf8');
if (!opfsSrcText.includes(legacyMainThreadGuard)) {
  console.warn(
    '[copy-sqlite-dist-assets] sqlite3-opfs-async-proxy.js: expected main-thread guard not found; leaving upstream file unchanged'
  );
} else {
  const count = opfsSrcText.split(legacyMainThreadGuard).length - 1;
  opfsSrcText = opfsSrcText.split(legacyMainThreadGuard).join(nestedWorkerSafeGuard);
  await writeFile(opfsDest, opfsSrcText, 'utf8');
  console.log(`[copy-sqlite-dist-assets] dist/sqlite3-opfs-async-proxy.js (${count} main-thread guard patch(es))`);
}
