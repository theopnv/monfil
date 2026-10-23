import { defineConfig } from 'vite';
import { coveragePlugins } from '../../scripts/coverage/vite-plugins.mts';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [...coveragePlugins('main')],
  // The key identifies the app to the analytics server and is not a secret.
  define: {
    'import.meta.env.MONFIL_APTABASE_KEY': JSON.stringify(process.env['MONFIL_APTABASE_KEY'] ?? ''),
    'import.meta.env.MONFIL_APTABASE_HOST': JSON.stringify(process.env['MONFIL_APTABASE_HOST'] ?? ''),
  },
  build: {
    rollupOptions: {
      // better-sqlite3 loads its .node binary via a path relative to its own package directory; bundling it breaks that resolution.
      // jsdom's dynamic, environment-sniffing requires (canvas, xhr, ...) don't survive a Rollup bundle.
      external: ['better-sqlite3', 'jsdom'],
    },
  },
});
