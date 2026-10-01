import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  build: {
    rollupOptions: {
      external: ['lit'],
    },
    lib: {
      entry: {
        'tectonas-ui': resolve(import.meta.dirname, 'src/index.ts'),
        'performance-summary': resolve(import.meta.dirname, 'src/components/performance-summary/index.ts'),
      },
      name: 'TectonasUI',
      fileName: (_format, entryName) => `${entryName}.js`,
      formats: ['es'],
    },
    sourcemap: true,
  },
});
