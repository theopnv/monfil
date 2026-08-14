import { test as base, expect, _electron as electron, type ElectronApplication } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

type SmokeTestFixtures = {
  electronApp: ElectronApplication;
};

const smokeTest = base.extend<SmokeTestFixtures>({
  electronApp: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    const electronApp = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    await use(electronApp);
    await electronApp.close();
    await rm(userDataDir, { recursive: true });
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

smokeTest('clicking "Add feed" opens the add-feed wizard', async ({ electronApp }) => {
  // Arrange
  const window = await electronApp.firstWindow();

  // Act
  await window.getByRole('button', { name: 'Add feed' }).click();

  // Assert
  await expect(window.getByRole('heading', { name: 'Add a source' })).toBeVisible();
})

