# sqlite-promiser

Async SQLite in the browser via **`@sqlite.org/sqlite-wasm`** loaded with **`sqlite3InitModule()`** and **OO API #1** inside a small dedicated worker (see [SQLite WASM loading](https://sqlite.org/wasm/doc/trunk/api-index.md#loading)). Your app still uses `await` on the main thread; the deprecated Worker1 promiser is not used.

- **OPFS** — when `crossOriginIsolated` is true **and** `navigator.storage.getDirectory` exists (typical with COOP/COEP headers).
- **Fallback** — **in-memory** SQLite (session-only) when isolation or OPFS is unavailable.

## Install

```bash
pnpm add sqlite-promiser @sqlite.org/sqlite-wasm
```

`@sqlite.org/sqlite-wasm` is a **peer dependency** of `sqlite-promiser`, so your app controls which SQLite WASM version is used (install any compatible version you prefer).

Published **`dist/`** always contains these **same-origin siblings** (do not omit any when copying or serving the worker):

- **`sqlite-oo1-worker.js`** — bundled `sqlite3InitModule()` + OO1 RPC
- **`sqlite3.wasm`** — copied from your installed `@sqlite.org/sqlite-wasm`
- **`sqlite3-opfs-async-proxy.js`** — copied from upstream and lightly patched for nested-worker contexts; required when SQLite opens the **OPFS async** VFS (see below)

Subpath exports for asset pipelines: **`sqlite-promiser/worker`**, **`sqlite-promiser/sqlite3.wasm`**, **`sqlite-promiser/opfs-async-proxy`**. Optional **`sqlite-promiser/vite`** provides a small dev plugin. See [gotchas](https://sqlite.org/wasm/doc/tip/gotchas.md) and [loading](https://sqlite.org/wasm/doc/trunk/api-index.md#loading).

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

### OPFS and nested workers

For durable OPFS storage, SQLite’s WASM build uses **two** workers from your page’s perspective:

1. The **OO1 worker** (`sqlite-oo1-worker.js`) — where `sqlite3InitModule()` runs and your app’s RPC lands.
2. An **OPFS async proxy** (`sqlite3-opfs-async-proxy.js`) — a nested `Worker` spawned by upstream code via `new URL("sqlite3-opfs-async-proxy.js", import.meta.url)` relative to the OO1 worker script.

If the proxy file is missing (404 HTML, wrong MIME type, or wrong directory), DevTools may show **blocked** or opaque failures even when COOP/COEP is correct. Keep the proxy next to the OO1 worker URL. Some embedded or strict Chromium builds can still fail the nested worker; the published proxy replaces a fragile `globalThis.window === globalThis` check with `typeof document !== "undefined"` so **main thread** is not confused with a **nested classic worker** where `DedicatedWorkerGlobalScope` may be unavailable.

You cannot remove SQLite’s internal OPFS helper worker without changing upstream; apps that previously used a **single** Vite worker with `OpfsDb` directly still had this nesting **inside** that worker. The stable integration path here is correct **URLs + headers**, not a separate worker graph on the main thread.

### Cross-origin isolation (OPFS)

OPFS-backed persistence needs a **cross-origin isolated** context (`SharedArrayBuffer`, `Atomics`, etc.). **`require-corp`** is the common default:

```ts
headersPresets().requireCorp;
// => {
//   'Cross-Origin-Opener-Policy': 'same-origin',
//   'Cross-Origin-Embedder-Policy': 'require-corp',
// }
```

**`credentialless`** is often easier when you rely on third-party iframes or assets that do not set CORP/CORS the way `require-corp` demands; behavior can differ by browser, so validate in your target environments.

```ts
headersPresets().credentialless;
```

Use `describeEnvironment()` in UI to explain why storage is in-memory.

### Vite

[`examples/example-vite`](../../examples/example-vite) uses **`sqlite-promiser/vite`** so COOP/COEP and optional dev origin stay in one place.

- **`VITE_COOP=1`** — applies `requireCorp` headers to `server` and `preview`.
- **`VITE_COOP_POLICY=credentialless`** — use with `VITE_COOP=1` to apply `credentialless` instead.
- **`VITE_DEV_ORIGIN`** — e.g. `https://localhost.example.com:5173` when the browser loads the app from a custom HTTPS hostname; sets `server.origin` / `preview.origin` so absolute worker or asset URLs match the page origin.

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { sqlitePromiserDevPlugin } from 'sqlite-promiser/vite';

export default defineConfig({
  plugins: [react(), sqlitePromiserDevPlugin()],
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  }
});
```

Manual alternative (avoids pulling the plugin): use **`sqlite-promiser/headers`** in config so Node does not load the WASM bundle during config evaluation:

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

If a custom dev middleware serves `*.js` workers as HTML or wrong `Content-Type`, the nested OPFS worker will fail; use **`application/javascript`** (or **`text/javascript`**) for worker scripts.

Serve the same COOP/COEP headers in production (CDN / static host).

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

Copy static assets from **`sqlite-promiser`** subpaths (after a library build or from `node_modules/sqlite-promiser/dist/`) so **`sqlite-oo1-worker.js`**, **`sqlite3.wasm`**, and **`sqlite3-opfs-async-proxy.js`** live in the same public directory. Optionally pass **`?sqlite3.wasm=`** on the worker script URL if WASM is hosted elsewhere.

### Plain JS / other bundlers

1. Install `sqlite-promiser` and `@sqlite.org/sqlite-wasm`.
2. Configure **COOP/COEP** on the HTML origin when you need OPFS.
3. Ensure **`sqlite-oo1-worker.js`**, **`sqlite3.wasm`**, and **`sqlite3-opfs-async-proxy.js`** are served **same-origin** with correct MIME types (or pass `?sqlite3.wasm=` on the worker URL). The OO1 worker resolves the OPFS proxy relative to its own script URL.

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
| `sqlite-promiser/worker` | OO1 worker script URL (for `Worker` or `require.resolve`) |
| `sqlite-promiser/sqlite3.wasm` | WASM bytes path |
| `sqlite-promiser/opfs-async-proxy` | OPFS async helper worker script (sibling of OO1 worker) |
| `sqlitePromiserDevPlugin()` (`sqlite-promiser/vite`) | Optional Vite dev/preview COOP + `origin` helpers |

`Database`: `exec`, `run`, `all`, `get`, `transaction`, `export`, `close`, `getDiagnostics`.

### Options

- `name` — logical DB name (sanitized for filenames).
- `preferOpfs` — default `true`.
- `fallback` — `'memory'` (default; IndexedDB planned separately).
- `vfs` — optional VFS override for the worker `open` step (advanced).
- `worker` — optional custom `Worker` factory; must still load the **published OO1 RPC** bundle (`sqlite-promiser/worker` or equivalent) so message shapes match. Use this when your bundler should own worker URL resolution (e.g. Vite `new URL('sqlite-promiser/worker', import.meta.url)`).

## Testing this repo

```bash
pnpm --filter sqlite-promiser test
pnpm exec playwright install chromium   # once per machine / CI image
pnpm test:e2e                           # from repo root
```

## License

MIT (this wrapper). `@sqlite.org/sqlite-wasm` is Apache-2.0 — see upstream.
