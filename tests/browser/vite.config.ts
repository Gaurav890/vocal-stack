import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('../../stackblitz-demos/03-full-pipeline', import.meta.url)),
  resolve: {
    alias: {
      'vocal-stack/text': fileURLToPath(new URL('../../dist/text/index.js', import.meta.url)),
      'vocal-stack/testing': fileURLToPath(new URL('../../dist/testing/index.js', import.meta.url)),
      'vocal-stack/trace': fileURLToPath(new URL('../../dist/trace/index.js', import.meta.url)),
      'vocal-stack/turn': fileURLToPath(new URL('../../dist/turn/index.js', import.meta.url)),
    },
  },
});
