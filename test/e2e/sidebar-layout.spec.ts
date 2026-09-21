import { test as base, expect, _electron as electron, type Locator, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOME_WORKSPACE_ID } from '../../src/preload/channels';

type SidebarLayoutFixtures = {
  userDataDir: string;
  page: Page;
};

const sidebarTest = base.extend<SidebarLayoutFixtures>({
  userDataDir: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    try {
      await use(userDataDir);
    } finally {
      await rm(userDataDir, { recursive: true });
    }
  },

  page: async ({ userDataDir }, use) => {
    const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    try {
      const page = await app.firstWindow();
      // The renderer answers `feeds:submit-add-feed` only once its IPC bridge is mounted.
      await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
      await use(page);
    } finally {
      await app.close();
    }
  },
});

// Subscribes without a network fetch or the wizard: enough for a feed and its category to exist.
// The reload is what puts the new feed in the sidebar: only the add-feed wizard refreshes the feed
// query, and this writes behind its back.
async function subscribe(page: Page, link: string, title: string, categoryName: string): Promise<void> {
  await page.evaluate(({ link, title, categoryName, workspaceId }) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
    link, title, type: 'rss', items: [], categoryName, workspaceId, showInWorkspace: true,
  }), { link, title, categoryName, workspaceId: HOME_WORKSPACE_ID });
  await page.reload();
}

async function boxOf(locator: Locator): Promise<{ x: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('expected the element to have a layout box');
  }
  return box;
}

const LONG_FEED_TITLE = 'An extremely long feed title that could never fit inside a narrow sidebar column';
const LONG_FOLDER_NAME = 'A folder name far too long for the sidebar to ever show in full';

sidebarTest('a long feed title stays inside the sidebar', async ({ page }) => {
  // Arrange
  await subscribe(page, 'http://127.0.0.1/feed-a', LONG_FEED_TITLE, 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();

  // Act
  await page.getByRole('button', { name: 'Tech', exact: true }).click();

  // Assert
  const list = await boxOf(page.getByRole('grid'));
  const row = await boxOf(page.getByRole('button', { name: new RegExp(`^${LONG_FEED_TITLE}`) }));
  expect(row.x + row.width).toBeLessThanOrEqual(list.x + list.width);
});

sidebarTest('a long folder name is truncated to one line', async ({ page }) => {
  // Arrange
  await subscribe(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await subscribe(page, 'http://127.0.0.1/feed-b', 'Feed B', LONG_FOLDER_NAME);

  // Assert
  const longFolder = page.getByRole('button', { name: LONG_FOLDER_NAME, exact: true });
  await expect(longFolder).toBeVisible();
  const list = await boxOf(page.getByRole('grid'));
  const longRow = await boxOf(longFolder);
  const shortRow = await boxOf(page.getByRole('button', { name: 'Tech', exact: true }));
  expect(longRow.x + longRow.width).toBeLessThanOrEqual(list.x + list.width);
  expect(longRow.height).toBe(shortRow.height);
});

sidebarTest('folder and feed counts share a right edge', async ({ page }) => {
  // Arrange
  await subscribe(page, 'http://127.0.0.1/feed-a', LONG_FEED_TITLE, 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();

  // Act
  await page.getByRole('button', { name: 'Tech', exact: true }).click();

  // Assert
  const folderCount = await boxOf(page.getByTestId('folder-count'));
  const feedCount = await boxOf(page.getByTestId('feed-count'));
  expect(Math.abs((folderCount.x + folderCount.width) - (feedCount.x + feedCount.width))).toBeLessThan(1);
});
