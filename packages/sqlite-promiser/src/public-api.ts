/**
 * Primary browser API for `sqlite-promiser`.
 *
 * @module
 */

export type {
  Database,
  DatabaseDiagnostics,
  ExecOptions,
  OpenOptions,
  RowObject,
  RowValue
} from './types.js';
export { SqliteWasmError } from './errors.js';
export { createDatabase } from './client/createDatabase.js';
export { describeEnvironment } from './capabilities/describeEnvironment.js';
export { headersPresets } from './headers/headersPresets.js';

