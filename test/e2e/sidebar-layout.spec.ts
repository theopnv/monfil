// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Locator, Page } from '@playwright/test';
import { expect, subscribeAndReload, test as base } from './fixtures';

const test = base.extend<{ page: Page }>({
  page: async ({ launchApp }, use) => {
    const page = await launchApp();
    // The renderer answers `feeds:submit-add-feed` only once its IPC bridge is mounted.
    await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
    await use(page);
  },
});

async function boxOf(locator: Locator): Promise<{ x: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('expected the element to have a layout box');
  }
  return box;
}

const LONG_FEED_TITLE = 'An extremely long feed title that could never fit inside a narrow sidebar column';
const LONG_FOLDER_NAME = 'A folder name far too long for the sidebar to ever show in full';

test('a long feed title stays inside the sidebar', async ({ page }) => {
  // Arrange
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', LONG_FEED_TITLE, 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();

  // Act
  await page.getByRole('button', { name: 'Tech', exact: true }).click();

  // Assert
  const list = await boxOf(page.getByRole('grid', { name: 'Feeds' }));
  const row = await boxOf(page.getByRole('button', { name: new RegExp(`^${LONG_FEED_TITLE}`) }));
  expect(row.x + row.width).toBeLessThanOrEqual(list.x + list.width);
});

test('a long folder name is truncated to one line', async ({ page }) => {
  // Arrange
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await subscribeAndReload(page, 'http://127.0.0.1/feed-b', 'Feed B', LONG_FOLDER_NAME);

  // Assert
  const longFolder = page.getByRole('button', { name: LONG_FOLDER_NAME, exact: true });
  await expect(longFolder).toBeVisible();
  const list = await boxOf(page.getByRole('grid', { name: 'Feeds' }));
  const longRow = await boxOf(longFolder);
  const shortRow = await boxOf(page.getByRole('button', { name: 'Tech', exact: true }));
  expect(longRow.x + longRow.width).toBeLessThanOrEqual(list.x + list.width);
  expect(longRow.height).toBe(shortRow.height);
});

test('a folder name that fits is shown in full until the row is hovered', async ({ page }) => {
  // Arrange
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Media & Podcasts');
  const label = page.getByRole('button', { name: 'Media & Podcasts', exact: true }).locator('span');
  await expect(label).toBeVisible();
  await page.mouse.move(0, 0);

  // Assert
  expect(await label.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true);
});

test('window controls reserve title bar space', async ({ launchElectron }) => {
  test.skip(process.platform === 'darwin');

  // Arrange
  const { app, page } = await launchElectron();
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.showInactive());

  // Act
  const overlay = await page.evaluate(() => {
    const controls = (navigator as Navigator & {
      windowControlsOverlay?: { visible: boolean; getTitlebarAreaRect(): DOMRect };
    }).windowControlsOverlay;
    return {
      visible: controls?.visible,
      width: controls?.getTitlebarAreaRect().width,
      height: controls?.getTitlebarAreaRect().height,
      windowWidth: window.innerWidth,
    };
  });

  // Assert
  expect(overlay.visible).toBe(true);
  expect(overlay.width).toBeLessThan(overlay.windowWidth);
  expect(overlay.height).toBe(32);
});

test('window controls follow the app theme', async ({ launchElectron }) => {
  test.skip(process.platform === 'darwin');

  // Arrange
  const { app, page } = await launchElectron();
  await app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0];
    if (!window) {
      throw new Error('expected an app window');
    }
    const setTitleBarOverlay = window.setTitleBarOverlay.bind(window);
    window.setTitleBarOverlay = (options) => {
      (window as typeof window & { lastTitleBarOverlay?: typeof options }).lastTitleBarOverlay = options;
      setTitleBarOverlay(options);
    };
  });

  const lastTitleBarOverlay = () => app.evaluate(({ BrowserWindow }) => {
    const window = BrowserWindow.getAllWindows()[0] as (typeof BrowserWindow.prototype) & {
      lastTitleBarOverlay?: { color?: string; symbolColor?: string; height?: number };
    };
    return window.lastTitleBarOverlay;
  });

  // Act
  await page.evaluate(() => localStorage.setItem('ui-theme', 'light'));
  await page.reload();

  // Assert
  await expect.poll(lastTitleBarOverlay).toEqual({ color: '#ebddc5', symbolColor: '#201e1d', height: 32 });

  // Act
  await page.evaluate(() => localStorage.setItem('ui-theme', 'dark'));
  await page.reload();

  // Assert
  await expect.poll(lastTitleBarOverlay).toEqual({ color: '#272019', symbolColor: '#f2e7d6', height: 32 });
});
