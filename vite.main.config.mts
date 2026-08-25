import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  build: {
    rollupOptions: {
      // better-sqlite3 loads its .node binary via a path relative to its own package directory; bundling it breaks that resolution.
      // jsdom's dynamic, environment-sniffing requires (canvas, xhr, ...) don't survive a Rollup bundle.
      external: ['better-sqlite3', 'jsdom'],
    },
  },
});
