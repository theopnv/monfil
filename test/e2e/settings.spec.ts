import { test as base, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { ResolvedTheme } from '../../src/renderer/providers/theme-provider';

type SettingsTestFixtures = {
  settingsPage: Page;
};

const settingsTest = base.extend<SettingsTestFixtures>({
  settingsPage: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    const electronApp = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    try {
      const settingsPage = await electronApp.firstWindow();
      await settingsPage.evaluate(() => {
        window.history.pushState(null, '', '#/settings');
      });
      await settingsPage.getByRole('heading', { name: 'Settings' }).waitFor();
      await use(settingsPage);
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
