# sqlite-promiser

Async SQLite in the browser with **OPFS persistence when available** and a **safe in-memory fallback**.

`sqlite-promiser` is a small wrapper around [`@sqlite.org/sqlite-wasm`](https://www.npmjs.com/package/@sqlite.org/sqlite-wasm) (Worker1 promiser) that makes it easy to:

- prefer **OPFS** (Origin Private File System) for persistence in cross-origin isolated contexts
- automatically fall back to **in-memory** SQLite when OPFS/isolation isn’t available
- use a simple async API (`exec`, `all`, `close`) and optional React helpers

This repository is a **pnpm workspace** containing the published library plus runnable examples.

## Features

- **OPFS-first**: use persistence when the environment supports it
- **Graceful fallback**: keep working in non-isolated environments (memory mode)
- **Framework-friendly**: works with plain JS/TS, React, Vite, Next.js (client components)
- **Header presets**: utilities to configure COOP/COEP for cross-origin isolation

## Install

```bash
pnpm add sqlite-promiser @sqlite.org/sqlite-wasm
```

`@sqlite.org/sqlite-wasm` is a **peer dependency** of `sqlite-promiser`, so your app controls which version is installed.

## Quick start

```ts
import { createDatabase, describeEnvironment } from 'sqlite-promiser';

console.log(describeEnvironment());
// { crossOriginIsolated, opfsAvailable, recommendedMode: 'opfs' | 'memory' }

const db = await createDatabase({ name: 'app', preferOpfs: true });

await db.exec(`CREATE TABLE IF NOT EXISTS todo (id INTEGER PRIMARY KEY, title TEXT)`);
await db.exec(`INSERT INTO todo (title) VALUES ('Buy milk')`);

const rows = await db.all(`SELECT id, title FROM todo`);
console.log(rows);

await db.close();
```

## OPFS persistence (COOP/COEP headers)

OPFS persistence requires a **cross-origin isolated** context (COOP/COEP). `sqlite-promiser` provides a Node-safe entry with ready-to-use header presets:

```ts
import { headersPresets } from 'sqlite-promiser/headers';
```

Common presets:

- `headersPresets().requireCorp`
- `headersPresets().credentialless`

You still need to serve these headers in production (CDN/origin), not just in dev.

## Usage with popular tooling

### Vite (dev + preview)

```ts
// vite.config.ts
import { defineConfig } from 'vite';
import { headersPresets } from 'sqlite-promiser/headers';

const coop = process.env.VITE_COOP === '1';
const headers = coop ? headersPresets().requireCorp : {};

export default defineConfig({
  optimizeDeps: {
    exclude: ['@sqlite.org/sqlite-wasm']
  },
  server: { headers },
  preview: { headers }
});
```

Run with OPFS enabled:

```bash
VITE_COOP=1 pnpm dev
```

### Next.js (App Router)

- Use `createDatabase()` **only in client components** (`'use client'`).
- Configure isolation headers in `next.config.ts`:

```ts
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

#### Example: client component

Create a client component, e.g. `app/db-demo/DbDemo.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { createDatabase, describeEnvironment } from 'sqlite-promiser';

export function DbDemo() {
  const [rows, setRows] = useState<Array<{ id: number; title: string }>>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        console.log(describeEnvironment());

        const db = await createDatabase({ name: 'next-app', preferOpfs: true });
        await db.exec(`CREATE TABLE IF NOT EXISTS todo (id INTEGER PRIMARY KEY, title TEXT)`);
        await db.exec(`INSERT INTO todo (title) VALUES ('Hello from Next.js')`);

        const r = await db.all<{ id: number; title: string }>(
          `SELECT id, title FROM todo ORDER BY id DESC LIMIT 10`
        );
        await db.close();

        if (!cancelled) setRows(r);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <pre>{error}</pre>;
  return <pre>{JSON.stringify(rows, null, 2)}</pre>;
}
```

Render it from a server component page, e.g. `app/db-demo/page.tsx`:

```tsx
import { DbDemo } from './DbDemo';

export default function Page() {
  return <DbDemo />;
}
```

#### Example: React hook

```tsx
'use client';

import { useDatabase } from 'sqlite-promiser/react';

export function DbDiagnostics() {
  const { db, loading, error } = useDatabase({ name: 'next-app' });
  if (loading) return <div>Loading…</div>;
  if (error || !db) return <pre>{String(error)}</pre>;
  return <pre>{JSON.stringify(db.getDiagnostics(), null, 2)}</pre>;
}
```

## API (high level)

This section documents the public API exported by the `sqlite-promiser` package.

### `createDatabase(options)`

Opens a database in a worker and returns an async `Database` handle.

- **OPFS vs memory**: by default it will try OPFS when the environment is cross-origin isolated and OPFS is available; otherwise it falls back to memory.
- **Serialized operations**: all calls (`exec`, `run`, `all`, `get`, `transaction`, etc.) are queued to run one-at-a-time per `Database` instance, so you can safely call methods without worrying about interleaving.

```ts
import { createDatabase } from 'sqlite-promiser';

const db = await createDatabase({
  name: 'app',
  preferOpfs: true,
  fallback: 'memory'
});
```

#### `OpenOptions`

- `name` (string, required): logical database name (used as OPFS filename when persistence is enabled)
- `preferOpfs` (boolean, default `true`): if `true`, try OPFS when supported
- `fallback` (`'memory'`, default `'memory'`): fallback when OPFS cannot be used
- `vfs` (string, optional): override the SQLite VFS name passed to Worker1 `open` (advanced)
- `worker` (`Worker | (() => Worker)`, optional): provide your own Worker instance/factory (advanced)

### `describeEnvironment()`

Returns environment info you can show in UI or logs:

```ts
import { describeEnvironment } from 'sqlite-promiser';

const env = describeEnvironment();
// {
//   crossOriginIsolated: boolean,
//   opfsAvailable: boolean,
//   recommendedMode: 'opfs' | 'memory'
// }
```

### `headersPresets()`

Returns common COOP/COEP header maps to enable cross-origin isolation (required for OPFS persistence):

```ts
import { headersPresets } from 'sqlite-promiser/headers';

const headers = headersPresets().requireCorp;
// {
//   'Cross-Origin-Opener-Policy': 'same-origin',
//   'Cross-Origin-Embedder-Policy': 'require-corp'
// }
```

### `SqliteWasmError`

Many underlying worker errors are normalized to `SqliteWasmError` so you can log/debug consistently.

```ts
import { SqliteWasmError } from 'sqlite-promiser';

try {
  // ...
} catch (e) {
  if (e instanceof SqliteWasmError) {
    console.error(e.message, { operation: e.operation, errorClass: e.errorClass, input: e.input });
  }
  throw e;
}
```

## `Database` methods

`createDatabase()` returns a `Database` with the methods below.

### `db.exec(sql, bind?)`

Execute SQL without returning rows.

```ts
await db.exec(`CREATE TABLE IF NOT EXISTS todo (id INTEGER PRIMARY KEY, title TEXT)`);
await db.exec(`INSERT INTO todo (title) VALUES (?)`, ['Buy milk']);
```

### `db.run(sql, bind?)`

Execute SQL and return write metadata when available.

```ts
const r = await db.run(`INSERT INTO todo (title) VALUES (?)`, ['Walk dog']);
console.log(r.changeCount, r.lastInsertRowId);
```

### `db.all<T>(sql, bind?)`

Query and return all rows as objects. Use the generic parameter for typed results.

```ts
type TodoRow = { id: number; title: string };
const rows = await db.all<TodoRow>(`SELECT id, title FROM todo ORDER BY id DESC LIMIT 10`);
```

### `db.get<T>(sql, bind?)`

Query and return the first row (or `undefined` if there are no rows).

```ts
type TodoRow = { id: number; title: string };
const row = await db.get<TodoRow>(`SELECT id, title FROM todo WHERE id = ?`, [123]);
if (!row) console.log('not found');
```

### `db.transaction(fn)`

Runs `fn(db)` inside a transaction (`BEGIN` → `COMMIT`).
If `fn` throws, the transaction is rolled back (`ROLLBACK`) and the error is rethrown.

```ts
await db.transaction(async (tx) => {
  await tx.exec(`INSERT INTO todo (title) VALUES (?)`, ['A']);
  await tx.exec(`INSERT INTO todo (title) VALUES (?)`, ['B']);
});
```

Return a value from the transaction:

```ts
const inserted = await db.transaction(async (tx) => {
  const r = await tx.run(`INSERT INTO todo (title) VALUES (?)`, ['Atomic insert']);
  return r.lastInsertRowId;
});
```

Notes:

- Nested transactions are not currently supported (this wrapper always issues `BEGIN`).
- Because operations are queued per `Database`, `transaction()` also prevents other calls from interleaving during the transaction.

### `db.export()`

Export the current database as a `Uint8Array` (SQLite file bytes).

```ts
const bytes = await db.export();
const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
const url = URL.createObjectURL(blob);

const a = document.createElement('a');
a.href = url;
a.download = 'app.sqlite';
a.click();

URL.revokeObjectURL(url);
```

### `db.close({ unlink? })`

Close the database. If you opened an OPFS-backed database, you can optionally request deletion via `unlink: true`.

```ts
await db.close();
// or (destructive):
await db.close({ unlink: true });
```

### `db.getDiagnostics()`

Returns a snapshot of how this database was opened (OPFS vs memory, VFS name, etc.).

```ts
const d = db.getDiagnostics();
// {
//   crossOriginIsolated,
//   opfsAvailable,
//   mode: 'opfs' | 'memory',
//   persistent,
//   vfs,
//   filename,
//   dbId
// }
```

## Monorepo layout

| Path | Description |
|------|-------------|
| [`packages/sqlite-promiser`](packages/sqlite-promiser) | Library (**published as `sqlite-promiser`**) |
| [`examples/example-vite`](examples/example-vite) | Minimal Vite + React demo |
| [`examples/example-nextjs`](examples/example-nextjs) | Next.js App Router demo |

## Development

Use **`pnpm`** (pinned via `packageManager` in the root `package.json`).

```bash
pnpm install
pnpm --filter sqlite-promiser build
pnpm test
pnpm test:e2e          # builds library, runs Playwright (install browsers once: see library README)
pnpm dev:example       # Vite demo on http://localhost:5173
```

## Contributing

Issues and PRs are welcome.

- Keep changes focused and add/update tests when it makes sense.
- Run `pnpm lint` and `pnpm test` before opening a PR.

## License

MIT © contributors
