/**
 * Promise bridge to the OO1 worker (`sqliteOo1Worker.ts`) — same call shape as the
 * deprecated `sqlite3Worker1Promiser` so {@link createDatabase} stays stable.
 */
/* eslint-disable @typescript-eslint/no-explicit-any */

export type Oo1WorkerPromiser = (type: string, args: any) => Promise<any>;

export type Oo1WorkerPromiserConfig = {
  worker: Worker | (() => Worker);
  onerror?: (...args: unknown[]) => void;
};

/**
 * @returns A Worker1-shaped `(type, args) => Promise<message>` function after the worker signals ready.
 */
export async function createOo1WorkerPromiser(config: Oo1WorkerPromiserConfig): Promise<Oo1WorkerPromiser> {
  const worker = typeof config.worker === 'function' ? config.worker() : config.worker;
  worker.onerror = (e) => {
    config.onerror?.(e);
  };

  let defaultDbId: string | undefined;
  let nextMid = 0;
  const pending = new Map<number, { resolve: (v: any) => void; reject: (e: any) => void }>();

  let readyResolve!: () => void;
  const readyPromise = new Promise<void>((resolve) => {
    readyResolve = resolve;
  });

  worker.addEventListener('message', (ev: MessageEvent) => {
    const d = ev.data;
    if (d?.type === 'sqlite3-api' && d?.result === 'oo1-worker-ready') {
      readyResolve();
      return;
    }
    if (typeof d?.mid !== 'number') return;
    const p = pending.get(d.mid);
    if (!p) return;
    pending.delete(d.mid);
    if (!d.ok) {
      p.reject({ type: 'error', result: d.result });
      return;
    }
    if (d.type === 'open') defaultDbId = d.result.dbId;
    if (d.type === 'close') defaultDbId = undefined;
    p.resolve({ type: d.type, dbId: d.dbId ?? defaultDbId, result: d.result });
  });

  await readyPromise;

  return (type: string, args: any) => {
    const mid = ++nextMid;
    return new Promise((resolve, reject) => {
      pending.set(mid, { resolve, reject });
      const msg: Record<string, unknown> = { mid, op: type };
      if (type === 'open') {
        msg.args = { filename: args.filename, vfs: args.vfs };
      } else if (type === 'config-get') {
        /* envelope only */
      } else {
        msg.dbId = args?.dbId ?? defaultDbId;
        if (type === 'exec') {
          const rest = { ...args };
          delete rest.dbId;
          msg.args = rest;
        } else if (type === 'close') {
          msg.args = { unlink: args?.unlink };
        }
      }
      worker.postMessage(msg);
    });
  };
}
