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
    projects: [
      {
        test: {
          name: 'node',
          exclude: [
            '**/test/e2e/**',
            '**/node_modules/**',
            '**/.claude/worktrees/**',
            '**/infra/**', // Each Worker runs its own tests in workerd
            '**/src/renderer/**', // Exclude renderer tests (integration), covered by Browser Mode
            // Each test opens a real file-backed SQLite connection and runs a migration step; on
            // Windows CI the per-step time swings from ~1s to over 20s run to run, too wide to cover
            // with a fixed timeout, so the file only runs on Linux/macOS.
            ...(process.platform === 'win32' ? ['**/src/main/db/migrations/migrations.test.ts'] : []),
          ],
          restoreMocks: true,
        },
      },
      './vitest.browser.config.mts',
    ],
  },
})
