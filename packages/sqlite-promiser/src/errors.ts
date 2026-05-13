/**
 * Normalized failure from the SQLite WASM worker bridge.
 *
 * Wraps unstructured worker errors while preserving upstream `operation`, `errorClass`, and `input` when present.
 */
export class SqliteWasmError extends Error {
  readonly operation: string | undefined;
  readonly errorClass: string | undefined;
  readonly input: unknown | undefined;
  readonly original: unknown | undefined;

  /**
   * @param message Human-readable summary.
   * @param opts Optional structured fields echoed from WASM promiser payloads.
   */
  constructor(message: string, opts?: { operation?: string; errorClass?: string; input?: unknown; original?: unknown }) {
    super(message);
    this.name = 'SqliteWasmError';
    this.operation = opts?.operation;
    this.errorClass = opts?.errorClass;
    this.input = opts?.input;
    this.original = opts?.original;
  }
}

function asRecord(v: unknown): Record<string, unknown> | undefined {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : undefined;
}

/**
 * Coerce any thrown value into {@link SqliteWasmError}.
 *
 * Recognizes `{ result: { operation, message, ... } }` shapes from worker RPC errors.
 *
 * @param err Unknown rejection or throw value from the WASM layer or this library.
 * @returns A stable subclass instance preserving metadata when inferable.
 */
export function toSqliteWasmError(err: unknown): SqliteWasmError {
  if (err instanceof SqliteWasmError) return err;
  if (err && typeof err === 'object') {
    const top = asRecord(err);
    const result = asRecord(top?.['result']);
    const operation = (result?.['operation'] ?? top?.['operation']) as string | undefined;
    const message =
      (result?.['message'] ?? top?.['message'] ?? 'SQLite WASM operation failed') as string;
    const errorClass = (result?.['errorClass'] ?? top?.['errorClass']) as string | undefined;
    const input = result?.['input'] ?? top?.['input'];
    const opts: { operation?: string; errorClass?: string; input?: unknown; original?: unknown } = { input, original: err };
    if (operation !== undefined) opts.operation = operation;
    if (errorClass !== undefined) opts.errorClass = errorClass;
    return new SqliteWasmError(String(message), opts);
  }
  return new SqliteWasmError('SQLite WASM operation failed', { original: err });
}
