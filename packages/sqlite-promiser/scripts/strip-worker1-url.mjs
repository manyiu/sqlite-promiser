/**
 * Upstream `@sqlite.org/sqlite-wasm` embeds `new URL("sqlite3-worker1.mjs", import.meta.url)` in dead code.
 * Vite's worker-import-meta-url plugin still resolves it when bundling apps, so we rewrite it to a no-op stub.
 */
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dist = path.join(__dirname, '..', 'dist');
const worker = path.join(dist, 'sqlite-oo1-worker.js');
const stub = path.join(dist, '_deprecated-worker1-stub.mjs');

const src = await readFile(worker, 'utf8');
const needle = 'new URL("sqlite3-worker1.mjs", import.meta.url)';
const replacement = 'new URL("./_deprecated-worker1-stub.mjs", import.meta.url)';
if (src.includes(replacement)) {
  console.log('[strip-worker1-url] already patched');
} else if (!src.includes(needle)) {
  console.warn('[strip-worker1-url] pattern not found; upstream bundle may have changed');
} else {
  await writeFile(worker, src.split(needle).join(replacement), 'utf8');
  console.log('[strip-worker1-url] patched sqlite-oo1-worker.js');
}
await writeFile(stub, '// Intentionally empty: satisfies bundlers analyzing deprecated Worker1 default URL.\n', 'utf8');
console.log('[strip-worker1-url] stub _deprecated-worker1-stub.mjs');
