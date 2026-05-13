import type { OpenOptions } from '../types.js';

function safeName(name: string): string {
  return name.replaceAll(/[^\w.-]/g, '_');
}

/**
 * Filename/URI targeting the OPFS VFS (`?vfs=opfs`), with a sanitized base name.
 *
 * @param name Logical database {@link OpenOptions.name}; non-alphanumeric characters become `_`.
 */
export function opfsFilename(name: string): string {
  return `file:${safeName(name)}.sqlite3?vfs=opfs`;
}

/**
 * Shared in-memory SQLite URI (`mode=memory&cache=shared`) derived from {@link OpenOptions.name}.
 *
 * @param name Logical database name; sanitized like {@link opfsFilename}.
 */
export function memoryFilename(name: string): string {
  return `file:${safeName(name)}?mode=memory&cache=shared`;
}

/**
 * Build worker `open` payload: sanitized filename and optional explicit `vfs`.
 *
 * When {@link OpenOptions.vfs options.vfs} is set it is forwarded; otherwise OPFS targets use {@link opfsFilename}
 * and non-OPFS paths use {@link memoryFilename}.
 *
 * @param opts At minimum `name` and optional custom `vfs`.
 * @param useOpfs Whether to prefer the OPFS URI shape for this attempt.
 */
export function buildOpenArgs(
  opts: Pick<OpenOptions, 'name' | 'vfs'>,
  useOpfs: boolean
): { filename: string; vfs?: string } {
  const vfs = opts.vfs;
  if (vfs) {
    if (useOpfs) {
      return { filename: `file:${safeName(opts.name)}.sqlite3`, vfs };
    }
    return { filename: memoryFilename(opts.name), vfs };
  }
  return useOpfs ? { filename: opfsFilename(opts.name) } : { filename: memoryFilename(opts.name) };
}
