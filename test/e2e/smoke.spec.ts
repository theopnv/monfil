// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ElectronApplication } from '@playwright/test';
import { expect, test as base } from './fixtures';

const test = base.extend<{ electronApp: ElectronApplication }>({
  electronApp: async ({ launchElectron }, use) => {
    await use((await launchElectron()).app);
  },
});

test('smoke test', async ({ electronApp }) => {
  const isPackaged = await electronApp.evaluate(async ({ app }) => {
    return app.isPackaged
  });

  // Act
  const window = await electronApp.firstWindow();

  // Assert
  expect(isPackaged).toBe(false);
  await expect(window.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
  await window.screenshot({ path: 'test-results/intro.png' });
})

test('clicking "Add feed" opens the add-feed wizard', async ({ electronApp }) => {
  // Arrange
  const window = await electronApp.firstWindow();

  // Act
  await window.getByRole('button', { name: 'Add feed', exact: true }).click();

  // Assert
  await expect(window.getByRole('heading', { name: 'Add a feed' })).toBeVisible();
})
