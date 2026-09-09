import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/test/e2e/**',
      '**/node_modules/**',
      '**/src/renderer/**', // Exclude renderer tests (integration), covered by Browser Mode
      // Each test opens a real file-backed SQLite connection and runs a migration step; on
      // Windows CI the per-step time swings from ~1s to over 20s run to run, too wide to cover
      // with a fixed timeout, so the file only runs on Linux/macOS.
      ...(process.platform === 'win32' ? ['**/src/main/db/migrations/migrations.test.ts'] : []),
    ],
    restoreMocks: true,
  },
})
