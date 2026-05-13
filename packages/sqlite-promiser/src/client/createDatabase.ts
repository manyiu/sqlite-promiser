/* eslint-disable @typescript-eslint/no-explicit-any -- worker RPC payloads are loosely typed upstream */
import type { RowObject, Database, DatabaseDiagnostics, OpenOptions } from '../types.js';
import { toSqliteWasmError } from '../errors.js';
import { describeEnvironment } from '../capabilities/describeEnvironment.js';
import { buildOpenArgs } from './buildOpenArgs.js';
import { createOo1WorkerPromiser } from './createOo1WorkerPromiser.js';

type Promiser = (type: string, args: any) => Promise<any>;

function defaultOo1Worker(): Worker {
  return new Worker(new URL('./sqlite-oo1-worker.js', import.meta.url), { type: 'module' });
}

type OpenResult = {
  filename: string;
  dbId: string;
  persistent: boolean;
  vfs: string;
};

function deriveMode(r: OpenResult): DatabaseDiagnostics['mode'] {
  if (r.persistent) {
    return 'opfs';
  }
  return 'memory';
}

/**
 * Open an async SQLite database in a dedicated worker using `sqlite3InitModule()` + OO API #1
 * (`@sqlite.org/sqlite-wasm`), following https://sqlite.org/wasm/doc/trunk/api-index.md#loading
 * instead of the deprecated Worker1 promiser.
 *
 * When {@link describeEnvironment} reports cross-origin isolation and OPFS, and `preferOpfs` is not `false`,
 * the library tries an OPFS-backed URI first. If open fails or the environment lacks OPFS, it can fall back
 * to shared memory (`fallback: 'memory'`, default) using a stable in-memory URI derived from the logical database name (`opts.name`).
 *
 * @param opts Name, persistence preference, optional custom worker, and advanced VFS overrides.
 * @returns A fully initialized {@link Database} handle sharing a single serialized command queue.
 * @throws {@link SqliteWasmError} When worker bootstrap or `open` fails irrecoverably.
 */
export async function createDatabase(opts: OpenOptions): Promise<Database> {
  const preferOpfs = opts.preferOpfs ?? true;
  const fallback = opts.fallback ?? 'memory';

  const env = describeEnvironment();
  const shouldTryOpfs = preferOpfs && env.crossOriginIsolated && env.opfsAvailable;

  const promiser: Promiser = await createOo1WorkerPromiser({
    worker: opts.worker ?? defaultOo1Worker,
    onerror: (...args: unknown[]) => {
      console.error('[sqlite-promiser] worker error', ...args);
    }
  });

  let openArgs = buildOpenArgs(opts, shouldTryOpfs);

  const openMsg = await promiser('open', openArgs as any).catch((e: unknown) => {
    if (shouldTryOpfs && fallback === 'memory') {
      openArgs = buildOpenArgs(opts, false);
      return promiser('open', openArgs as any);
    }
    throw toSqliteWasmError(e);
  });

  const r = (openMsg as { result: OpenResult }).result;
  const dbId = r.dbId;
  const filename = r.filename;

  let diagnostics: DatabaseDiagnostics = {
    crossOriginIsolated: env.crossOriginIsolated,
    opfsAvailable: env.opfsAvailable,
    mode: deriveMode(r),
    persistent: r.persistent,
    vfs: r.vfs,
    filename,
    dbId
  };

  let chain = Promise.resolve<void>(undefined);
  const enqueue = <T>(fn: () => Promise<T>): Promise<T> => {
    const next = chain.then(fn, fn);
    chain = next.then(
      () => undefined,
      () => undefined
    );
    return next;
  };

  const execRows = async <T extends RowObject>(sql: string, bind?: unknown): Promise<T[]> => {
    const msg = await promiser('exec', {
      dbId,
      sql,
      bind,
      returnValue: 'this',
      __collectRows: true
    } as any).catch((e: unknown) => {
      throw toSqliteWasmError(e);
    });
    const rows = ((msg as any).result?.resultRows ?? []) as T[];
    return rows;
  };

  const db: Database = {
    exec: (sql, bind) =>
      enqueue(async () => {
        await promiser('exec', { dbId, sql, bind, returnValue: 'this' } as any).catch((e: unknown) => {
          throw toSqliteWasmError(e);
        });
      }),

    run: (sql, bind) =>
      enqueue(async () => {
        const msg = await promiser('exec', {
          dbId,
          sql,
          bind,
          returnValue: 'this',
          countChanges: true,
          lastInsertRowId: true
        } as any).catch((e: unknown) => {
          throw toSqliteWasmError(e);
        });
        const res: any = (msg as any).result ?? {};
        return { changeCount: res.changeCount, lastInsertRowId: res.lastInsertRowId };
      }),

    all: (sql, bind) => enqueue(() => execRows(sql, bind)),

    get: (sql, bind) =>
      enqueue(async () => {
        const rows = await execRows(sql, bind);
        return rows[0] as any;
      }),

    transaction: (fn) =>
      enqueue(async () => {
        await db.exec('BEGIN');
        try {
          const out = await fn(db);
          await db.exec('COMMIT');
          return out;
        } catch (e) {
          try {
            await db.exec('ROLLBACK');
          } catch {
            // ignore rollback failure; surface original
          }
          throw e;
        }
      }),

    export: () =>
      enqueue(async () => {
        const msg = await promiser('export', { dbId } as any).catch((e: unknown) => {
          throw toSqliteWasmError(e);
        });
        return (msg as any).result.byteArray as Uint8Array;
      }),

    close: (closeOpts) =>
      enqueue(async () => {
        await promiser('close', { dbId, unlink: closeOpts?.unlink } as any).catch((e: unknown) => {
          throw toSqliteWasmError(e);
        });
      }),

    getDiagnostics: () => diagnostics
  };

  try {
    await promiser('config-get', {} as any);
  } catch {
    // ignore
  }

  diagnostics = {
    ...diagnostics,
    mode: deriveMode(r),
    persistent: r.persistent,
    vfs: r.vfs
  };

  return db;
}
