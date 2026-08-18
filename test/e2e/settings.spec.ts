import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

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

settingsTest('choosing Dark applies the dark theme, and Light removes it', async ({ settingsPage }) => {
  // Act
  await settingsPage.getByRole('button', { name: 'Dark', exact: true }).click();

  // Assert
  await expect.poll(() => settingsPage.evaluate(() => document.documentElement.className)).toContain('dark-mode');

  // Act
  await settingsPage.getByRole('button', { name: 'Light', exact: true }).click();

  // Assert
  await expect.poll(() => settingsPage.evaluate(() => document.documentElement.className)).not.toContain('dark-mode');
})

settingsTest('choosing System clears the stored theme override', async ({ settingsPage }) => {
  // Arrange
  await settingsPage.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect.poll(() => settingsPage.evaluate(() => localStorage.getItem('ui-theme'))).toBe('dark');

  // Act
  await settingsPage.getByRole('button', { name: 'System', exact: true }).click();

  // Assert
  await expect.poll(() => settingsPage.evaluate(() => localStorage.getItem('ui-theme'))).toBeNull();
})

settingsTest('should default the refresh interval to 30 min', async ({ settingsPage }) => {
  // Assert
  await expect(settingsPage.getByRole('button', { name: '30 min', pressed: true })).toBeVisible();
})

base('should keep the chosen refresh interval after a restart', async () => {
  // Arrange
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'))

  try {
    const first = await openSettings(userDataDir)
    try {
      // Act
      await first.page.getByRole('button', { name: '6 h', exact: true }).click();
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
      await expect(second.page.getByRole('button', { name: '6 h', pressed: true })).toBeVisible();
    } finally {
      await second.electronApp.close()
    }
  } finally {
    await rm(userDataDir, { recursive: true })
  }
})

base('should keep "Refresh on launch" after a restart', async () => {
  // Arrange
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'))

  try {
    const first = await openSettings(userDataDir)
    try {
      // Act
      await first.page.getByText('Refresh on launch', { exact: true }).click();
      await expect
        .poll(() => first.page.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-on-launch', undefined)))
        .toBe(false)
    } finally {
      await first.electronApp.close()
    }

    const second = await openSettings(userDataDir)
    try {
      // Assert
      await expect
        .poll(() => second.page.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-on-launch', undefined)))
        .toBe(false)
    } finally {
      await second.electronApp.close()
    }
  } finally {
    await rm(userDataDir, { recursive: true })
  }
})
