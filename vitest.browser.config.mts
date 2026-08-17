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
  // Pre-bundle up front so concurrent browser instances (chromium/firefox/webkit)
  // never race a mid-run dependency discovery against each other.
  optimizeDeps: {
    include: ['react-aria-components'],
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
    },
  },
})
