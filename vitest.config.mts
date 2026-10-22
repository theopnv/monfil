import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'istanbul',
      // The HTML reporter keeps the coverage report in place when it sits in its own output folder.
      reportsDirectory: '.vitest/coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.{test,spec}.{ts,tsx}',
        'src/**/*.d.ts',
        'src/renderer/components/untitled-ui/**',
        'src/renderer/routeTree.gen.ts',
      ],
      reporter: ['json', 'html', 'text-summary'],
    },
    projects: ['./vitest.node.config.mts', './vitest.browser.config.mts'],
  },
})
