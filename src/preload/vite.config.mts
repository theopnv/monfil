import { defineConfig } from 'vite';
import { sentryBuild } from '../../scripts/sentry/vite-plugin.mts';
import manifest from '../../package.json' with { type: 'json' };

const sentry = sentryBuild(manifest.version);

// https://vitejs.dev/config
export default defineConfig({
  build: { sourcemap: sentry.sourcemap },
  plugins: [...sentry.plugins, {
    name: 'preload-single-file-build',
    configResolved(config) {
      const output = config.build.rollupOptions.output;
      if (output && !Array.isArray(output)) {
        delete output.inlineDynamicImports;
        output.codeSplitting = false;
      }
    },
  }],
});
