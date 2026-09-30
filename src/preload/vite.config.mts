import { defineConfig } from 'vite';

// https://vitejs.dev/config
export default defineConfig({
  plugins: [{
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
