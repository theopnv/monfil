import { defineConfig } from '@playwright/test';

export default defineConfig({
  testMatch: /test\/e2e\/.*\.spec.ts/,
  workers: 1,
});
