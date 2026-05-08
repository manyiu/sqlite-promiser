import { describe, expect, it } from 'vitest';
import { buildOpenArgs, memoryFilename, opfsFilename } from './buildOpenArgs.js';

describe('buildOpenArgs', () => {
  it('uses URI vfs for default OPFS', () => {
    expect(buildOpenArgs({ name: 'my db' }, true).filename).toContain('vfs=opfs');
    expect(buildOpenArgs({ name: 'my db' }, true).vfs).toBeUndefined();
  });

  it('uses explicit vfs when provided', () => {
    const a = buildOpenArgs({ name: 'app', vfs: 'opfs' }, true);
    expect(a.filename).toBe('file:app.sqlite3');
    expect(a.vfs).toBe('opfs');
  });

  it('memory uses shared cache URI', () => {
    expect(memoryFilename('x')).toContain('mode=memory');
    expect(opfsFilename('x')).toContain('.sqlite3');
  });
});
