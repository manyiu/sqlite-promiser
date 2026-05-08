/**
 * `@sqlite.org/sqlite-wasm`-compatible **server/Node conditional** stub.
 *
 * Bundlers resolving the package `"node"` export should not instantiate WASM on the server;
 * import the default/browser export in client bundles (`createDatabase` in `./client/createDatabase`).
 *
 * @module node
 */

import type { Database, OpenOptions } from './types.js';
import { SqliteWasmError } from './errors.js';

/** @inheritDoc describeEnvironment */
export { describeEnvironment } from './capabilities/describeEnvironment.js';
/** @inheritDoc headersPresets */
export { headersPresets } from './headers/headersPresets.js';

/**
 * Node entrypoint stub.
 *
 * Next.js may resolve package exports using the "node" condition while building
 * the server graph. SQLite WASM + OPFS requires a browser environment, so this
 * function always throws in Node.
 */
export async function createDatabase(_opts: OpenOptions): Promise<Database> {
  void _opts;
  throw new SqliteWasmError('sqlite-promiser can only be used in the browser (client components).');
}

