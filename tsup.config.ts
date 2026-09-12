import { defineConfig } from 'tsup';

export default defineConfig({
  entry: {
    index: 'src/index.ts',
    'sanitizer/index': 'src/sanitizer/index.ts',
    'flow/index': 'src/flow/index.ts',
    'monitor/index': 'src/monitor/index.ts',
    'text/index': 'src/text/index.ts',
    'turn/index': 'src/turn/index.ts',
    'telemetry/index': 'src/telemetry/index.ts',
    'testing/index': 'src/testing/index.ts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: false,
  clean: true,
  treeshake: true,
  splitting: false,
  minify: true,
  outDir: 'dist',
  target: 'es2022',
  platform: 'neutral',
});
