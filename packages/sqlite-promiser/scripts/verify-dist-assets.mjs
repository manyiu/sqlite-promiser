import { readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dist = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist');
const required = ['sqlite-oo1-worker.js', 'sqlite3.wasm', 'sqlite3-opfs-async-proxy.js'];

for (const name of required) {
  const p = path.join(dist, name);
  try {
    const st = statSync(p);
    if (!st.isFile() || st.size === 0) {
      console.error(`[verify-dist-assets] missing or empty: ${p}`);
      process.exit(1);
    }
  } catch {
    console.error(`[verify-dist-assets] missing: ${p}`);
    process.exit(1);
  }
}

const worker = readFileSync(path.join(dist, 'sqlite-oo1-worker.js'), 'utf8');
if (!worker.includes('sqlite3-opfs-async-proxy.js')) {
  console.error('[verify-dist-assets] sqlite-oo1-worker.js does not reference sqlite3-opfs-async-proxy.js');
  process.exit(1);
}

console.log('[verify-dist-assets] OK');
