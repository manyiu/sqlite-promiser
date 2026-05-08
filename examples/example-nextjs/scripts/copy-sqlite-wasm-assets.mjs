import { copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const distDir = path.join(root, 'node_modules', '@sqlite.org', 'sqlite-wasm', 'dist');
const publicDir = path.join(root, 'public');

await mkdir(publicDir, { recursive: true });

const files = ['sqlite3.wasm', 'sqlite3-worker1.mjs', 'sqlite3-opfs-async-proxy.js'];

await Promise.all(
  files.map(async (f) => {
    await copyFile(path.join(distDir, f), path.join(publicDir, f));
  })
);

console.log(`[copy-sqlite-wasm-assets] Copied ${files.length} files to public/`);

