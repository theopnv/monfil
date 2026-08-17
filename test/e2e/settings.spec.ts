import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ResolvedTheme } from '../../src/renderer/providers/theme-provider';

type SettingsTestFixtures = {
  settingsPage: Page;
};

async function openSettings(userDataDir: string): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
  const page = await electronApp.firstWindow();
  await page.evaluate(() => {
    window.history.pushState(null, '', '#/settings');
  });
  await page.getByRole('heading', { name: 'Settings' }).waitFor();
  return { electronApp, page };
}

const settingsTest = base.extend<SettingsTestFixtures>({
  settingsPage: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    const { electronApp, page } = await openSettings(userDataDir);
    try {
      await use(page);
    } finally {
      await electronApp.close();
      await rm(userDataDir, { recursive: true });
    }
  }
});

settingsTest('should display settings page', async ({ settingsPage }) => {
  // Assert
  const heading = settingsPage.getByRole('heading', { name: 'Settings' })
  await expect(heading).toBeVisible()
})

settingsTest('should toggle theme', async ({ settingsPage }) => {
  // Arrange
  const darkTheme = 'dark' satisfies ResolvedTheme
  const isDark = (className: string) => className.includes(darkTheme)

  const rootClassBefore = await settingsPage.evaluate(() => document.documentElement.className)
  const wasDark = isDark(rootClassBefore)

  // Act
  const themeToggleButton = settingsPage.getByRole('button', { name: 'Toggle theme' })
  await themeToggleButton.click()

  // Assert
  const rootClass = await settingsPage.evaluate(() => document.documentElement.className)
  expect(isDark(rootClass)).toBe(!wasDark)

  // Act 2
  await themeToggleButton.click()

  // Assert 2
  const rootClassAfter = await settingsPage.evaluate(() => document.documentElement.className)
  expect(rootClassAfter).toBe(rootClassBefore)
})

settingsTest('should default the refresh interval to every 30 minutes', async ({ settingsPage }) => {
  // Assert
  await expect(settingsPage.getByLabel('Refresh feeds')).toHaveValue('30')
})

base('should keep the chosen refresh interval after a restart', async () => {
  // Arrange
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'))

  try {
    const first = await openSettings(userDataDir)
    try {
      // Act
      await first.page.getByLabel('Refresh feeds').selectOption('360')
      // The invoke reply only comes back once the main process has written the row.
      await expect
        .poll(() => first.page.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-interval', undefined)))
        .toBe(360)
    } finally {
      await first.electronApp.close()
    }

    const second = await openSettings(userDataDir)
    try {
      // Assert
      await expect(second.page.getByLabel('Refresh feeds')).toHaveValue('360')
    } finally {
      await second.electronApp.close()
    }
  } finally {
    await rm(userDataDir, { recursive: true })
  }
})
