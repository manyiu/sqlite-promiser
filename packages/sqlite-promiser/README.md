# sqlite-promiser

Async SQLite in the browser via **`@sqlite.org/sqlite-wasm`** Worker1 **promiser** (SQLite runs in a worker; your app uses `await` on the main thread).

- **OPFS** — when `crossOriginIsolated` is true **and** `navigator.storage.getDirectory` exists (typical with COOP/COEP headers).
- **Fallback** — **in-memory** SQLite (session-only) when isolation or OPFS is unavailable.

## Install

```bash
pnpm add sqlite-promiser @sqlite.org/sqlite-wasm
```

`@sqlite.org/sqlite-wasm` is a **peer dependency** of `sqlite-promiser`, so your app controls which SQLite WASM version is used (install any compatible version you prefer).

The worker and WASM load from `@sqlite.org/sqlite-wasm` as resolved by your bundler (see [WA-SQL gotchas](https://sqlite.org/wasm/doc/tip/gotchas.md)).

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

Copy or expose `sqlite3.wasm` from `node_modules/@sqlite.org/sqlite-wasm/dist/` if your deploy pipeline requires explicit static assets.

### Plain JS / other bundlers

1. Install `sqlite-promiser` and `@sqlite.org/sqlite-wasm`.
2. Configure **COOP/COEP** on the HTML origin when you need OPFS.
3. Ensure the worker can resolve `sqlite3-worker1.mjs` / `sqlite3.wasm` (same-origin or correct base URL).

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
- `vfs` — optional Worker1 `vfs` override for advanced setups.
- `worker` — optional custom `Worker` factory.

## Testing this repo

```bash
pnpm --filter sqlite-promiser test
pnpm exec playwright install chromium   # once per machine / CI image
pnpm test:e2e                           # from repo root
```

## License

MIT (this wrapper). `@sqlite.org/sqlite-wasm` is Apache-2.0 — see upstream.
