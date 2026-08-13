import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    exclude: [
      '**/test/e2e/**',
      '**/node_modules/**',
      '**/src/renderer/**' // Exclude renderer tests (integration), covered by Browser Mode
    ],
    restoreMocks: true,
  },
})
