import { defineConfig } from 'vitest/config'
import { playwright } from '@vitest/browser-playwright'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src/renderer`,
    },
  },
  // Pre-bundle up front. A dep discovered mid-run forces Vite to reload the page, which breaks whatever test is in flight at that moment (vitest-dev/vitest#9509, #9473, #8447).
  // Vitest's own "unexpectedly reloaded a test" warning names the late-discovered deps. List them here so the reload never happens.
  optimizeDeps: {
    include: ['react-aria-components', '@tanstack/react-router-devtools', '@tanstack/react-router', 'react-dom/client'],
  },
  test: {
    include: [
      'src/renderer/**/*.{test,spec}.?(c|m)[jt]s?(x)',
    ],
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      // https://vitest.dev/config/browser/playwright
      instances: [
        { browser: 'chromium' },
        { browser: 'firefox' },
        { browser: 'webkit' },
      ],
      // Concurrent instances hitting one dev server cause flaky "failed to import" and "failed to find the runner" errors in CI: vitest-dev/vitest#9509, #9473, #8447
      fileParallelism: false,
    },
  },
})
