// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Page } from '@playwright/test';
import { expect, test as base } from './fixtures';

async function openSettings(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.history.pushState(null, '', '#/settings');
  });
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
}

const test = base.extend<{ settingsPage: Page }>({
  settingsPage: async ({ launchApp }, use) => {
    const page = await launchApp();
    await openSettings(page);
    await use(page);
  },
});

test('should display settings page', async ({ settingsPage }) => {
  // Assert
  const heading = settingsPage.getByRole('heading', { name: 'Settings' })
  await expect(heading).toBeVisible()
})

test('choosing Dark applies the dark theme, and Light removes it', async ({ settingsPage }) => {
  // Act
  await settingsPage.getByRole('button', { name: 'Dark', exact: true }).click();

  // Assert
  await expect.poll(() => settingsPage.evaluate(() => document.documentElement.className)).toContain('dark-mode');

  // Act
  await settingsPage.getByRole('button', { name: 'Light', exact: true }).click();

  // Assert
  await expect.poll(() => settingsPage.evaluate(() => document.documentElement.className)).not.toContain('dark-mode');
})

test('choosing System clears the stored theme override', async ({ settingsPage }) => {
  // Arrange
  await settingsPage.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(() => settingsPage.evaluate(() => localStorage.getItem('ui-theme'))).toBe('dark');

  // Act
  await settingsPage.getByRole('button', { name: 'System', exact: true }).click();

  // Assert
  await expect.poll(() => settingsPage.evaluate(() => localStorage.getItem('ui-theme'))).toBeNull();
})

test('should default the refresh interval to 30 min', async ({ settingsPage }) => {
  // Assert
  await expect(settingsPage.getByRole('button', { name: '30 min', pressed: true })).toBeVisible();
})

test('should keep the chosen refresh interval after a restart', async ({ launchApp }) => {
  // Arrange
  const first = await launchApp();
  await openSettings(first);

  // Act
  await first.getByRole('button', { name: '6 h', exact: true }).click();
  // The invoke reply only comes back once the main process has written the row.
  await expect
    .poll(() => first.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-interval', undefined)))
    .toBe(360);
  const second = await launchApp();
  await openSettings(second);

  // Assert
  await expect(second.getByRole('button', { name: '6 h', pressed: true })).toBeVisible();
});

test('should keep "Refresh on launch" after a restart', async ({ launchApp }) => {
  // Arrange
  const first = await launchApp();
  await openSettings(first);

  // Act
  await first.getByText('Refresh on launch', { exact: true }).click();
  await expect
    .poll(() => first.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-on-launch', undefined)))
    .toBe(false);
  const second = await launchApp();
  await openSettings(second);

  // Assert
  await expect
    .poll(() => second.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-on-launch', undefined)))
    .toBe(false);
});

test('should keep the expanded workspace rail after a restart', async ({ launchApp }) => {
  // Arrange
  const first = await launchApp();
  await openSettings(first);

  // Act
  await first.getByRole('button', { name: 'Show workspace names' }).click();
  await expect(first.getByRole('button', { name: 'Hide workspace names' })).toBeVisible();
  const second = await launchApp();
  await openSettings(second);

  // Assert
  await expect(second.getByRole('button', { name: 'Hide workspace names' })).toBeVisible();
});
