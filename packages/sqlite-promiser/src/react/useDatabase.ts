import { useEffect, useMemo, useRef, useState } from 'react';
import { createDatabase } from '../client/createDatabase.js';
import type { Database, OpenOptions } from '../types.js';

/** State emitted by {@link useDatabase} while opening or after failure. */
export type UseDatabaseResult = {
  /** Open handle once resolved; `undefined` during load or after teardown. */
  db: Database | undefined;
  /** `true` until the initial {@link createDatabase} promise settles. */
  loading: boolean;
  /** Populated when open rejects; cleared on retry when options key changes. */
  error: unknown | undefined;
};

type CacheEntry = {
  dbPromise: Promise<Database>;
  refCount: number;
};

const cache = new Map<string, CacheEntry>();

function cacheKey(opts: OpenOptions): string {
  return JSON.stringify({
    name: opts.name,
    preferOpfs: opts.preferOpfs ?? true,
    fallback: opts.fallback ?? 'memory',
    vfs: opts.vfs,
    hasWorker: Boolean(opts.worker)
  });
}

/**
 * Open (or reuse) a {@link Database} keyed by canonicalized {@link OpenOptions}.
 *
 * - **Sharing**: Same logical options share one underlying `createDatabase()` promise via an in-memory cache.
 * - **Strict Mode**: Increments/decrements a ref count per mount so double-invoked effects release only when the last unmount fires.
 *
 * Intended for client components (`'use client'` in frameworks that distinguish server bundles).
 *
 * @param options Forwarded to {@link createDatabase}; keep referential equality stable via `useMemo` if constructing inline.
 * @returns Loading/error/database triple for rendering guards.
 */
export function useDatabase(options: OpenOptions): UseDatabaseResult {
  const key = useMemo(() => cacheKey(options), [options]);
  const optsRef = useRef(options);
  optsRef.current = options;

  const [db, setDb] = useState<Database | undefined>(undefined);
  const [error, setError] = useState<unknown>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let entry = cache.get(key);
    if (!entry) {
      entry = { dbPromise: createDatabase(optsRef.current), refCount: 0 };
      cache.set(key, entry);
    }
    entry.refCount += 1;
    setLoading(true);
    setError(undefined);

    let cancelled = false;
    entry.dbPromise
      .then((d) => {
        if (cancelled) return;
        setDb(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e);
        setLoading(false);
      });

    return () => {
      cancelled = true;
      const current = cache.get(key);
      if (!current) return;
      current.refCount -= 1;
      if (current.refCount <= 0) {
        // Fire-and-forget close; avoid blocking unmount.
        current.dbPromise.then((d) => d.close().catch(() => undefined)).catch(() => undefined);
        cache.delete(key);
      }
    };
  }, [key]);

  return { db, loading, error };
}

