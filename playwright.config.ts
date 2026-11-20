import { defineConfig } from '@playwright/test';

// electron.launch() forwards process.env to the app by default, so setting this here
// (before any spec calls electron.launch()) is enough to reach every test without threading it through
// each spec's launch call.
// main.ts reads it to keep the window hidden instead of stealing focus.
process.env['E2E_TEST'] = '1';
// Hints would cover buttons in specs that add feeds over IPC on a fresh profile. test/e2e/hints.spec.ts sets it back to 'on'.
process.env['MONFIL_HINTS'] = 'off';

// These assert wall-clock budgets (enrichment-performance, volume) or open every dialog in several languages (layout-audit).
// A second app on the same CPU makes them time out, so they run alone after the others.
const ALONE = /(enrichment-performance|layout-audit|volume)\.spec\.ts/;

export default defineConfig({
  testDir: './test/e2e',
  testMatch: /.*\.spec\.ts/,
  workers: 2,
  projects: [
    { name: 'parallel', testIgnore: ALONE },
    { name: 'alone', testMatch: ALONE, workers: 1, dependencies: ['parallel'] },
  ],
});
