import { test as base, expect, _electron as electron, type ElectronApplication } from '@playwright/test';

type SmokeTestFixtures = {
  electronApp: ElectronApplication;
};

const smokeTest = base.extend<SmokeTestFixtures>({
  electronApp: async ({}, use) => {
    const electronApp = await electron.launch({ args: ['.'] });
    await use(electronApp);
    await electronApp.close();
  }
});

smokeTest('smoke test', async ({ electronApp }) => {
  const isPackaged = await electronApp.evaluate(async ({ app }) => {
    return app.isPackaged
  });

  // Act
  const window = await electronApp.firstWindow();

  // Assert
  expect(isPackaged).toBe(false);
  await window.screenshot({ path: 'test-results/intro.png' });
})

