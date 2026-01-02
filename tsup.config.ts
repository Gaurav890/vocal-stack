import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'sanitizer/index': 'src/sanitizer/index.ts',
    'flow/index': 'src/flow/index.ts',
    'monitor/index': 'src/monitor/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: false,
  outDir: 'dist',
  target: 'es2022',
  platform: 'node',
});
