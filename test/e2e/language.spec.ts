// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test as base, expect, _electron as electron, type ElectronApplication, type Page, type TestInfo } from '@playwright/test';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';
import arabicMain from '../../src/shared/i18n/locales/ar/main.json' with { type: 'json' };
import frenchMain from '../../src/shared/i18n/locales/fr/main.json' with { type: 'json' };

type Launch = (userDataDir?: string) => Promise<{ app: ElectronApplication; page: Page }>;

type LanguageFixtures = {
  userDataDir: string;
  launch: Launch;
};

const languageTest = base.extend<LanguageFixtures>({
  userDataDir: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    try {
      await use(userDataDir);
    } finally {
      await rm(userDataDir, { recursive: true });
    }
  },

  launch: async ({ userDataDir }, use) => {
    const apps: ElectronApplication[] = [];
    await use(async (dir = userDataDir) => {
      const app = await electron.launch({ args: ['.', `--user-data-dir=${dir}`] });
      apps.push(app);
      return { app, page: await app.firstWindow() };
    });
    await Promise.all(apps.map((app) => app.close().catch(() => undefined)));
  },
});

async function openSettings(page: Page): Promise<void> {
  await page.evaluate(() => {
    window.history.pushState(null, '', '#/settings');
  });
  await expect(page.locator('select[aria-label]').first()).toBeVisible();
}

function languagePicker(page: Page) {
  return page.locator('select').filter({ has: page.locator('option[value="ar"]') });
}

async function documentState(page: Page): Promise<{ lang: string; dir: string }> {
  return page.evaluate(() => ({ lang: document.documentElement.lang, dir: document.documentElement.dir }));
}

async function attachScreenshot(page: Page, testInfo: TestInfo, name: string): Promise<void> {
  await testInfo.attach(name, { body: await page.screenshot(), contentType: 'image/png' });
}

// The native menu cannot be read from the page, so the test records the labels that main hands to Electron.
async function recordMenuLabels(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ Menu }) => {
    const record = globalThis as { __menuLabels?: string[] };
    record.__menuLabels = [];
    const build = Menu.buildFromTemplate.bind(Menu);
    Menu.buildFromTemplate = (template) => {
      record.__menuLabels?.push(...template.map((item) => item.label ?? ''));
      const menu = build(template);
      menu.popup = () => undefined;
      return menu;
    };
  });
}

async function openFeedMenu(app: ElectronApplication, page: Page, feedId: number): Promise<string[]> {
  await app.evaluate(() => {
    (globalThis as { __menuLabels?: string[] }).__menuLabels = [];
  });
  await page.evaluate((id) => window.electron.ipcRenderer.sendMessage('feeds:show-feed-context-menu', id), feedId);
  await expect.poll(() => app.evaluate(() => (globalThis as { __menuLabels?: string[] }).__menuLabels?.length ?? 0)).toBeGreaterThan(0);
  return app.evaluate(() => (globalThis as { __menuLabels?: string[] }).__menuLabels ?? []);
}

async function subscribe(page: Page): Promise<number> {
  const result = await page.evaluate((workspaceId) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
    link: 'http://127.0.0.1/feed-language', title: 'Language feed', type: 'rss', items: [], categoryName: 'Tech', workspaceId, showInWorkspace: true,
  }), HOME_WORKSPACE_ID);
  if (!('success' in result) || !result.success) {
    throw new Error('the feed could not be added');
  }
  return result.data.id;
}

languageTest('switching to Arabic flips the page, the sidebar rail, the font, and the next native menu at once', async ({ launch }, testInfo) => {
  // Arrange
  const { app, page } = await launch();
  const feedId = await subscribe(page);
  await recordMenuLabels(app);
  await openSettings(page);
  const rail = page.locator('nav').first();
  const leftToRight = await rail.boundingBox();
  expect(leftToRight?.x).toBe(0);

  // Act
  await languagePicker(page).selectOption('ar');

  // Assert
  await expect.poll(() => documentState(page)).toEqual({ lang: 'ar', dir: 'rtl' });
  const viewport = await page.evaluate(() => window.innerWidth);
  await expect.poll(async () => ((await rail.boundingBox())?.x ?? 0) > viewport / 2).toBe(true);
  expect(await page.evaluate(() => getComputedStyle(document.body).fontFamily)).not.toContain('Figtree');
  expect(await openFeedMenu(app, page, feedId)).toEqual([arabicMain.menu.feed.refreshFeed, arabicMain.menu.feed.moveFeed, arabicMain.menu.feed.deleteFeed]);
  await attachScreenshot(page, testInfo, 'settings-ar');
});

languageTest('the chosen language survives a restart and shows from the first paint', async ({ launch, userDataDir }) => {
  // Arrange
  const first = await launch();
  await openSettings(first.page);
  await languagePicker(first.page).selectOption('ar');
  await expect.poll(() => documentState(first.page)).toEqual({ lang: 'ar', dir: 'rtl' });
  await first.app.close();

  // Act
  const second = await launch(userDataDir);
  await second.page.waitForLoadState('domcontentloaded');

  // Assert
  expect(await documentState(second.page)).toEqual({ lang: 'ar', dir: 'rtl' });
});

languageTest('German text does not overflow the settings page', async ({ launch }, testInfo) => {
  // Arrange
  const { page } = await launch();
  await openSettings(page);

  // Act
  await languagePicker(page).selectOption('de');

  // Assert
  await expect.poll(() => documentState(page)).toEqual({ lang: 'de', dir: 'ltr' });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
  await attachScreenshot(page, testInfo, 'settings-de');
});

languageTest('French menus follow the choice, and System goes back to the language of the system', async ({ launch }) => {
  // Arrange
  const { app, page } = await launch();
  const feedId = await subscribe(page);
  await recordMenuLabels(app);
  await openSettings(page);
  const systemLanguage = (await documentState(page)).lang;

  // Act
  await languagePicker(page).selectOption('fr');

  // Assert
  expect(await openFeedMenu(app, page, feedId)).toEqual([frenchMain.menu.feed.refreshFeed, frenchMain.menu.feed.moveFeed, frenchMain.menu.feed.deleteFeed]);

  // Act
  await languagePicker(page).selectOption('system');

  // Assert
  await expect.poll(async () => (await documentState(page)).lang).toBe(systemLanguage);
});

const LANGUAGES_WITH_TRANSLATIONS = ['fr', 'de', 'es', 'it', 'pt', 'zh', 'ja', 'ar'] as const;

for (const code of LANGUAGES_WITH_TRANSLATIONS) {
  languageTest(`every button of the new workspace dialog stays inside it in ${code}`, async ({ launch }) => {
    // Arrange
    const { page } = await launch();
    await openSettings(page);
    await languagePicker(page).selectOption(code);
    await expect.poll(async () => (await documentState(page)).lang).toBe(code);
    const words = JSON.parse(await readFile(path.join('src/shared/i18n/locales', code, 'workspace.json'), 'utf8')) as { rail: { new: string }; dialog: { browse: string } };
    await page.evaluate(() => {
      window.history.pushState(null, '', '#/');
    });

    // Act
    await page.getByRole('button', { name: words.rail.new }).first().click();

    // Assert
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    // A reviewer may shorten a translation, so the test stretches the label to the length of the longest draft.
    await dialog.getByRole('button', { name: words.dialog.browse }).evaluate((element, label) => {
      element.textContent = `${label} ${label}`;
    }, words.dialog.browse);
    const frame = await dialog.boundingBox();
    const buttons = await dialog.getByRole('button').all();
    expect(buttons.length).toBeGreaterThan(2);
    for (const button of buttons) {
      const box = await button.boundingBox();
      expect(box).not.toBeNull();
      expect(box?.x).toBeGreaterThanOrEqual((frame?.x ?? 0) - 1);
      expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual((frame?.x ?? 0) + (frame?.width ?? 0) + 1);
    }
  });
}
