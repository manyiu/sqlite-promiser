/**
 * Value types surfaced as column values when using `object` row mode with the WASM worker.
 * Matches typical SQLite scalar types usable across the Worker JSON bridge.
 */
export type RowValue = string | number | bigint | Uint8Array | null;

/** One result row keyed by column name. */
export type RowObject = Record<string, RowValue>;

/** Options for helpers that delegate to Worker `exec` with explicit SQL/bind. */
export type ExecOptions = {
  /** SQL to run (may contain multiple statements, per upstream WASM behavior). */
  sql: string;
  /** Bind value(s): single value, array, or object map, as supported by `@sqlite.org/sqlite-wasm`. */
  bind?: unknown;
};

/**
 * Arguments for {@link createDatabase}.
 *
 * `name` is sanitized for safe use inside Worker1 URI strings when building OPFS or memory filenames.
 */
export type OpenOptions = {
  /**
   * Logical database name. When OPFS is available, this becomes an OPFS-backed
   * file. When not available, the library will fall back to in-memory.
   */
  name: string;
  /**
   * Prefer durable OPFS storage when possible. Default: true.
   */
  preferOpfs?: boolean;
  /**
   * Fallback when OPFS is unavailable due to missing cross-origin isolation or
   * missing OPFS support.
   */
  fallback?: 'memory';
  /**
   * Override SQLite VFS name passed to Worker1 `open` (advanced).
   * Example: `'opfs'` when using a filename without `?vfs=` in the URI.
   */
  vfs?: string;
  /**
   * Optional explicit worker instance (advanced). If provided, it must be a
   * module worker capable of importing `@sqlite.org/sqlite-wasm` worker entry.
   */
  worker?: Worker | (() => Worker);
};

/** Snapshot of how the surrounding page and this connection relate to isolation, OPFS, and VFS. */
export type DatabaseDiagnostics = {
  /** Whether `globalThis.crossOriginIsolated` is true (COOP/COEP effective). */
  crossOriginIsolated: boolean;
  /** Whether the browser exposes OPFS primitives needed for persistence. */
  opfsAvailable: boolean;
  /** Heuristic persistence mode inferred from SQLite’s open result for this DB. */
  mode: 'opfs' | 'memory';
  /** From SQLite open result: backed by a durable VFS such as OPFS. */
  persistent: boolean;
  /** VFS name reported by SQLite for this connection. */
  vfs: string;
  /** Connection filename/URI fragment used when opening (may include `vfs=` query params). */
  filename: string;
  /** Stable id used by Worker1 routing for this DB handle. */
  dbId: string;
};

/**
 * Async SQLite handle backed by `@sqlite.org/sqlite-wasm` Worker1.
 *
 * All mutating operations are queued on a single in-order chain so callers never interleave statements on the worker.
 */
export type Database = {
  /**
   * Execute SQL without collecting rows (callbacks disabled).
   *
   * @param sql SQL statement(s).
   * @param bind Optional bind parameters.
   * @throws {@link SqliteWasmError} On worker/exec failure.
   */
  exec(sql: string, bind?: unknown): Promise<void>;

  /**
   * Run a statement and return change metadata from the worker reply.
   *
   * @param sql SQL statement.
   * @param bind Optional bind parameters.
   */
  run(
    sql: string,
    bind?: unknown
  ): Promise<{ changeCount?: number | bigint; lastInsertRowId?: bigint }>;

  /**
   * Run a query and return all rows as objects (`rowMode: 'object'`).
   *
   * @typeParam T Row shape (defaults to {@link RowObject}).
   * @param sql SQL query.
   * @param bind Optional bind parameters.
   */
  all<T extends RowObject = RowObject>(sql: string, bind?: unknown): Promise<T[]>;

  /**
   * Return the first row of a query or `undefined` if zero rows.
   *
   * @typeParam T Row shape (defaults to {@link RowObject}).
   */
  get<T extends RowObject = RowObject>(sql: string, bind?: unknown): Promise<T | undefined>;

  /**
   * Wrap work in `BEGIN` / `COMMIT`, or `ROLLBACK` on rejection.
   *
   * @typeParam T Return type of `fn`.
   * @param fn Async callback receiving this database for nested operations.
   */
  transaction<T>(fn: (db: Database) => Promise<T>): Promise<T>;

  /**
   * Produce a SQLite database file dump as bytes (for backup or hydration elsewhere).
   */
  export(): Promise<Uint8Array>;

  /**
   * Close the connection and optionally unlink OPFS-backed files when supported.
   *
   * @param opts When `unlink: true`, request removal of persisted storage for this URI where applicable.
   */
  close(opts?: { unlink?: boolean }): Promise<void>;

  /** Current diagnostics captured at open (and refined after WASM config probe). */
  getDiagnostics(): DatabaseDiagnostics;
};

