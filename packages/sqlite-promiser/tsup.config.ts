import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: {
      index: 'src/index.ts',
      react: 'src/react.ts',
      headers: 'src/headers.ts',
      node: 'src/node.ts'
    },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2022',
    treeshake: true,
    splitting: false,
    outDir: 'dist',
    outExtension({ format }) {
      return format === 'cjs' ? { js: '.cjs' } : { js: '.js' };
    },
    external: ['react', '@sqlite.org/sqlite-wasm']
  },
  {
    entry: { 'sqlite-oo1-worker': 'src/worker/sqliteOo1Worker.ts' },
    format: ['esm'],
    platform: 'browser',
    target: 'es2022',
    sourcemap: true,
    clean: false,
    splitting: false,
    treeshake: true,
    outDir: 'dist',
    dts: false,
    noExternal: ['@sqlite.org/sqlite-wasm']
  }
]);

