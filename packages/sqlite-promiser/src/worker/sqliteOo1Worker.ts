/**
 * Dedicated module worker: loads SQLite via the default `sqlite3InitModule()` export
 * and OO API #1 (`sqlite3.oo1.DB`), per https://sqlite.org/wasm/doc/trunk/api-index.md#loading
 *
 * Replaces the deprecated Worker1 + promiser stack while keeping the same RPC surface
 * for the main-thread bridge.
 */
/* eslint-disable @typescript-eslint/no-explicit-any -- sqlite3 namespace is loosely typed upstream */

import sqlite3InitModule from '@sqlite.org/sqlite-wasm';

type OpenArgs = { filename: string; vfs?: string };
type ExecArgs = {
  sql: string;
  bind?: unknown;
  returnValue?: string;
  rowMode?: string;
  callback?: string;
  columnNames?: string[];
  countChanges?: boolean | number;
  lastInsertRowId?: boolean;
  __collectRows?: boolean;
};
type CloseArgs = { unlink?: boolean };

type Inbound =
  | { mid: number; op: 'open'; args: OpenArgs }
  | { mid: number; op: 'exec'; dbId: string; args: ExecArgs | string }
  | { mid: number; op: 'export'; dbId: string }
  | { mid: number; op: 'close'; dbId: string; args?: CloseArgs }
  | { mid: number; op: 'config-get' };

let sqlite3: any;
let initPromise: Promise<any> | null = null;

function defaultModuleArg(): Record<string, unknown> {
  try {
    const script = new URL(import.meta.url);
    const wasm = script.searchParams.get('sqlite3.wasm');
    if (!wasm) return {};
    const abs = new URL(wasm, self.location.href).href;
    return {
      locateFile: (path: string) => (path === 'sqlite3.wasm' ? abs : path)
    };
  } catch {
    return {};
  }
}

async function ensureInit(): Promise<void> {
  if (!initPromise) {
    initPromise = sqlite3InitModule({ ...defaultModuleArg() } as any);
  }
  sqlite3 = await initPromise;
}

const idMap = new WeakMap<any, string>();
let idSeq = 0;

function getDbId(db: any): string {
  let id = idMap.get(db);
  if (id) return id;
  id = `db#${++idSeq}:${Math.floor(Math.random() * 1e8)}:${Math.floor(Math.random() * 1e8)}`;
  idMap.set(db, id);
  return id;
}

const dbs: Record<string, any> = Object.create(null);
const dbList: any[] = [];

function getDb(id: string | undefined, require = true): any {
  const db = (id && dbs[id]) || dbList[0];
  if (require && (!db || !db.pointer)) {
    throw new Error(id ? `Unknown (or closed) DB ID: ${id}` : 'No database is opened.');
  }
  return db;
}

function post(mid: number, type: string, result: unknown, dbId: string | undefined, xfer: Transferable[] = []) {
  const msg: any = { mid, ok: true, type, dbId, result };
  if (xfer.length) globalThis.postMessage(msg, xfer);
  else globalThis.postMessage(msg);
}

function postError(mid: number, operation: string, err: unknown, input: unknown) {
  const e = err as Error;
  const result = {
    operation,
    message: e?.message ?? String(err),
    errorClass: e?.name ?? 'Error',
    input,
    stack: e?.stack ? e.stack.split(/\n\s*/) : undefined
  };
  globalThis.postMessage({ mid, ok: false, type: 'error', result });
}

function openDb(args: OpenArgs) {
  const DB = sqlite3.oo1.DB;
  const oargs: any = Object.create(null);
  oargs.filename = args.filename ?? '';
  if (args.vfs) oargs.vfs = args.vfs;
  const db = new DB(oargs);
  const id = getDbId(db);
  dbs[id] = db;
  if (dbList.indexOf(db) < 0) dbList.push(db);
  return {
    filename: db.filename,
    persistent: !!sqlite3.capi.sqlite3_js_db_uses_vfs(db.pointer, 'opfs'),
    dbId: id,
    vfs: db.dbVfsName()
  };
}

function closeDb(db: any, alsoUnlink: boolean) {
  if (!db) return { filename: undefined as string | undefined };
  const id = getDbId(db);
  delete dbs[id];
  const filename = db.filename;
  const util = sqlite3.util;
  const pVfs = util.sqlite3__wasm_db_vfs(db.pointer, 0);
  db.close();
  const ix = dbList.indexOf(db);
  if (ix >= 0) dbList.splice(ix, 1);
  if (alsoUnlink && filename && pVfs) util.sqlite3__wasm_vfs_unlink(pVfs, filename);
  return { filename };
}

function handleExec(db: any, evArgs: ExecArgs | string) {
  const rc: any = typeof evArgs === 'string' ? { sql: evArgs } : { ...(evArgs || {}) };
  if (rc.rowMode === 'stmt') throw new Error("Invalid rowMode for 'exec': stmt mode does not work over RPC.");
  if (!rc.sql) throw new Error("'exec' requires input SQL.");

  if (rc.__collectRows) {
    delete rc.__collectRows;
    rc.returnValue = 'resultRows';
    rc.rowMode = rc.rowMode || 'object';
  }

  const wantLastInsert = !!rc.lastInsertRowId;
  const countChanges = rc.countChanges;

  const changesBefore = countChanges ? db.changes(true, countChanges === 64) : undefined;
  db.exec(rc);
  if (changesBefore !== undefined) {
    rc.changeCount = db.changes(true, countChanges === 64) - changesBefore;
  }
  if (wantLastInsert) {
    rc.lastInsertRowId = sqlite3.capi.sqlite3_last_insert_rowid(db);
  }
  return rc;
}

const boot = ensureInit().then(() => {
  globalThis.postMessage({ type: 'sqlite3-api', result: 'oo1-worker-ready' });
});

globalThis.onmessage = async (ev: MessageEvent<Inbound>) => {
  const data = ev.data;
  const mid = data.mid;
  try {
    await boot;
    switch (data.op) {
      case 'open': {
        const result = openDb(data.args);
        post(mid, 'open', result, result.dbId);
        return;
      }
      case 'close': {
        const db = getDb(data.dbId, false);
        const unlink = !!(data.args && typeof data.args === 'object' && data.args.unlink);
        const result = closeDb(db, unlink);
        post(mid, 'close', result, data.dbId);
        return;
      }
      case 'exec': {
        const db = getDb(data.dbId);
        const result = handleExec(db, data.args);
        post(mid, 'exec', result, getDbId(db));
        return;
      }
      case 'export': {
        const db = getDb(data.dbId);
        const byteArray = sqlite3.capi.sqlite3_js_db_export(db.pointer);
        const response = {
          byteArray,
          filename: db.filename,
          mimetype: 'application/x-sqlite3'
        };
        post(mid, 'export', response, getDbId(db), [byteArray.buffer]);
        return;
      }
      case 'config-get': {
        const rc: any = Object.create(null);
        const src = sqlite3.config;
        ['bigIntEnabled'].forEach((k) => {
          if (Object.getOwnPropertyDescriptor(src, k)) rc[k] = src[k];
        });
        rc.version = sqlite3.version;
        rc.vfsList = sqlite3.capi.sqlite3_js_vfs_list();
        post(mid, 'config-get', rc, undefined);
        return;
      }
      default:
        throw new Error(`Unknown op: ${(data as any).op}`);
    }
  } catch (err) {
    postError(mid, (data as any).op ?? 'unknown', err, data);
  }
};
