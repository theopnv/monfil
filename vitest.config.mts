import { defineConfig } from 'vitest/config'
import { EXCLUDE, INCLUDE } from './scripts/coverage/vite-plugins.mts'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      // The HTML reporter keeps the coverage report in place when it sits in its own output folder.
      reportsDirectory: '.vitest/coverage',
      include: INCLUDE,
      exclude: EXCLUDE,
      reporter: ['json', 'html', 'text-summary'],
    },
    projects: ['./vitest.node.config.mts', './vitest.browser.config.mts'],
  },
})
