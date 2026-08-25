import { defineConfig } from '@playwright/test';

// electron.launch() forwards process.env to the app by default, so setting this here
// (before any spec calls electron.launch()) is enough to reach every test without threading it through
// each spec's launch call.
// main.ts reads it to keep the window hidden instead of stealing focus.
process.env['E2E_TEST'] = '1';

export default defineConfig({
  testMatch: /test\/e2e\/.*\.spec.ts/,
  workers: 1,
});
