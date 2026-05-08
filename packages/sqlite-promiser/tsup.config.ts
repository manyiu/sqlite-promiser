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
  }
]);

