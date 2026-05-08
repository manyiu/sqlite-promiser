/* eslint-disable @typescript-eslint/no-explicit-any -- Worker1 promiser messages are loosely typed upstream */
import type { RowObject, Database, DatabaseDiagnostics, OpenOptions } from '../types.js';
import { toSqliteWasmError } from '../errors.js';
import { describeEnvironment } from '../capabilities/describeEnvironment.js';
import { buildOpenArgs } from './buildOpenArgs.js';

type Worker1Promiser = (type: string, args: any) => Promise<any>;

async function createWorker1Promiser(config: any): Promise<Worker1Promiser> {
  /**
   * We intentionally avoid importing `sqlite3Worker1Promiser` as a *named* export
   * because some bundlers (notably Next.js/webpack) will validate named exports
   * against a "node" resolution during compilation.
   *
   * Dynamic import + property access avoids that static export validation while
   * still working correctly in the browser bundle.
   */
  const mod: any = await import('@sqlite.org/sqlite-wasm');
  const factory = mod?.sqlite3Worker1Promiser;
  if (typeof factory !== 'function') {
    throw new Error('Failed to load sqlite3Worker1Promiser from @sqlite.org/sqlite-wasm');
  }
  return (await factory(config)) as Worker1Promiser;
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
 * Open an async SQLite database in the browser via Worker1 + `@sqlite.org/sqlite-wasm`.
 *
 * When {@link describeEnvironment} reports cross-origin isolation and OPFS, and `preferOpfs` is not `false`,
 * the library tries an OPFS-backed URI first. If open fails or the environment lacks OPFS, it can fall back
 * to shared memory (`fallback: 'memory'`, default) using a stable in-memory URI derived from the logical database name (`opts.name`).
 *
 * @param opts Name, persistence preference, optional custom worker, and advanced VFS overrides.
 * @returns A fully initialized {@link Database} handle sharing a single serialized command queue.
 * @throws {@link SqliteWasmError} When promiser bootstrap or `open` fails irrecoverably.
 */
export async function createDatabase(opts: OpenOptions): Promise<Database> {
  const preferOpfs = opts.preferOpfs ?? true;
  const fallback = opts.fallback ?? 'memory';

  const env = describeEnvironment();
  const shouldTryOpfs = preferOpfs && env.crossOriginIsolated && env.opfsAvailable;

  const promiser: Worker1Promiser = await createWorker1Promiser({
    worker: opts.worker,
    onerror: (...args: unknown[]) => {
      console.error('[sqlite-promiser] worker error', ...args);
    }
  } as any);

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
    const rows: T[] = [];
    await promiser('exec', {
      dbId,
      sql,
      bind,
      rowMode: 'object',
      callback: (ev: { row?: unknown; rowNumber?: number | null }) => {
        if (ev.row !== undefined) {
          rows.push(ev.row as T);
        }
      },
      returnValue: 'this'
    } as any).catch((e: unknown) => {
      throw toSqliteWasmError(e);
    });
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
        const msg = await promiser('exec', { dbId, sql, bind, returnValue: 'this' } as any).catch((e: unknown) => {
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
