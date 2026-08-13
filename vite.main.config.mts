import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 loads its .node binary via a path relative to its own
      // package directory; bundling it breaks that resolution.
      external: ['better-sqlite3'],
    },
  },
});
