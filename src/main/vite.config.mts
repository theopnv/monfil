import { defineConfig } from 'vite';
import { coveragePlugins } from '../../scripts/coverage/vite-plugins.mts';
import { sentryBuild } from '../../scripts/sentry/vite-plugin.mts';
import manifest from '../../package.json' with { type: 'json' };

const sentry = sentryBuild(manifest.version);

// https://vitejs.dev/config
export default defineConfig({
  plugins: [...coveragePlugins('main'), ...sentry.plugins],
  // The key and the DSN identify the app to the analytics server and the error tracker, and neither is a secret.
  define: {
    'import.meta.env.MONFIL_APTABASE_KEY': JSON.stringify(process.env['MONFIL_APTABASE_KEY'] ?? ''),
    'import.meta.env.MONFIL_APTABASE_HOST': JSON.stringify(process.env['MONFIL_APTABASE_HOST'] ?? ''),
    'import.meta.env.MONFIL_SENTRY_DSN': JSON.stringify(process.env['MONFIL_SENTRY_DSN'] ?? ''),
  },
  build: {
    sourcemap: sentry.sourcemap,
    rollupOptions: {
      // better-sqlite3 loads its .node binary via a path relative to its own package directory; bundling it breaks that resolution.
      // jsdom's dynamic, environment-sniffing requires (canvas, xhr, ...) don't survive a Rollup bundle.
      external: ['better-sqlite3', 'jsdom'],
    },
  },
});
