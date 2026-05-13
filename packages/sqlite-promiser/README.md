# sqlite-promiser

Async SQLite in the browser via **`@sqlite.org/sqlite-wasm`** loaded with **`sqlite3InitModule()`** and **OO API #1** inside a small dedicated worker (see [SQLite WASM loading](https://sqlite.org/wasm/doc/trunk/api-index.md#loading)). Your app still uses `await` on the main thread; the deprecated Worker1 promiser is not used.

- **OPFS** — when `crossOriginIsolated` is true **and** `navigator.storage.getDirectory` exists (typical with COOP/COEP headers).
- **Fallback** — **in-memory** SQLite (session-only) when isolation or OPFS is unavailable.

## Install

```bash
pnpm add sqlite-promiser @sqlite.org/sqlite-wasm
```

`@sqlite.org/sqlite-wasm` is a **peer dependency** of `sqlite-promiser`, so your app controls which SQLite WASM version is used (install any compatible version you prefer).

The build emits **`dist/sqlite-oo1-worker.js`** (bundled `sqlite3InitModule()` + OO1 RPC) and copies **`dist/sqlite3.wasm`** next to it so the default worker can fetch WASM from the same directory. Subpath exports **`sqlite-promiser/worker`** and **`sqlite-promiser/sqlite3.wasm`** mirror those files for static hosting or `require.resolve()` in asset pipelines. Override with your own worker when your host needs a different layout (see [gotchas](https://sqlite.org/wasm/doc/tip/gotchas.md)).

## Quick start

```ts
import { createDatabase, describeEnvironment, headersPresets } from 'sqlite-promiser';

console.log(describeEnvironment());

const db = await createDatabase({ name: 'app', preferOpfs: true });

await db.exec(`CREATE TABLE IF NOT EXISTS todo (id INTEGER PRIMARY KEY, title TEXT)`);
await db.run(`INSERT INTO todo (title) VALUES (?)`, ['Buy milk']);

const rows = await db.all(`SELECT id, title FROM todo`);
console.log(rows);

await db.close();
```

### Diagnostics

```ts
const { mode, persistent, vfs, crossOriginIsolated, opfsAvailable } = db.getDiagnostics();
// mode: 'opfs' | 'memory'
```

### Cross-origin isolation (OPFS)

OPFS-backed persistence needs a **cross-origin isolated** context. Send headers such as:

```ts
headersPresets().requireCorp;
// => {
//   'Cross-Origin-Opener-Policy': 'same-origin',
//   'Cross-Origin-Embedder-Policy': 'require-corp',
// }
```

Less strict alternative (may fit some apps better):

```ts
headersPresets().credentialless;
```

Use `describeEnvironment()` in UI to explain why storage is in-memory.

### Vite

[`examples/example-vite`](../../examples/example-vite) sets dev/preview headers when `VITE_COOP=1`.

Use the **`sqlite-promiser/headers`** entry in `vite.config.ts` so Node does not load the SQLite WASM bundle during config evaluation:

```ts
import { headersPresets } from 'sqlite-promiser/headers';

const coop = process.env.VITE_COOP === '1';

export default defineConfig({
  server: {
    headers: coop ? headersPresets().requireCorp : {}
  },
  preview: {
    headers: coop ? headersPresets().requireCorp : {}
  }
});
```

Serve the same headers in production (CDN / static host).

### Next.js (App Router)

Use **only in client components**. Never call `createDatabase` on the server.

```tsx
'use client';

import { useEffect } from 'react';
import { createDatabase } from 'sqlite-promiser';

export function DbLoader() {
  useEffect(() => {
    void (async () => {
      const db = await createDatabase({ name: 'app' });
      // ...
      await db.close();
    })();
  }, []);
  return null;
}
```

Headers for isolation (adjust `source` / `matcher`):

```ts
// next.config.ts
import type { NextConfig } from 'next';
import { headersPresets } from 'sqlite-promiser/headers';

const nextConfig: NextConfig = {
  async headers() {
    const h = headersPresets().requireCorp;
    return [
      {
        source: '/:path*',
        headers: Object.entries(h).map(([key, value]) => ({ key, value }))
      }
    ];
  }
};

export default nextConfig;
```

Copy **`sqlite3.wasm`** from `node_modules/@sqlite.org/sqlite-wasm/dist/` when your deploy pipeline requires explicit static assets, and (for Next.js-style setups) the built **`sqlite-oo1-worker.js`** from `node_modules/sqlite-promiser/dist/` so `?sqlite3.wasm=` on the worker URL can point at your public WASM URL.

### Plain JS / other bundlers

1. Install `sqlite-promiser` and `@sqlite.org/sqlite-wasm`.
2. Configure **COOP/COEP** on the HTML origin when you need OPFS.
3. Ensure **`sqlite-oo1-worker.js`** and **`sqlite3.wasm`** are same-origin (or pass `?sqlite3.wasm=` on the worker script URL). The default worker URL is `./sqlite-oo1-worker.js` next to the published library entry.

## React

```tsx
import { useDatabase } from 'sqlite-promiser/react';

export function Demo() {
  const { db, loading, error } = useDatabase({ name: 'app' });

  if (loading || error || !db) return <div>{error ? String(error) : '…'}</div>;

  return <pre>{JSON.stringify(db.getDiagnostics(), null, 2)}</pre>;
}
```

## API

| Export | Purpose |
|--------|---------|
| `createDatabase(options)` | Open DB (worker + OPFS or memory) |
| `describeEnvironment()` | `{ crossOriginIsolated, opfsAvailable, recommendedMode }` |
| `headersPresets()` | COOP/COEP maps for servers |
| `SqliteWasmError` | Normalized errors from the worker |

`Database`: `exec`, `run`, `all`, `get`, `transaction`, `export`, `close`, `getDiagnostics`.

### Options

- `name` — logical DB name (sanitized for filenames).
- `preferOpfs` — default `true`.
- `fallback` — `'memory'` (default; IndexedDB planned separately).
- `vfs` — optional VFS override for the worker `open` step (advanced).
- `worker` — optional custom `Worker` factory.

## Testing this repo

```bash
pnpm --filter sqlite-promiser test
pnpm exec playwright install chromium   # once per machine / CI image
pnpm test:e2e                           # from repo root
```

## License

MIT (this wrapper). `@sqlite.org/sqlite-wasm` is Apache-2.0 — see upstream.
