// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ElectronApplication, Locator, Page } from '@playwright/test';
import { HOME_WORKSPACE_ID, type NewFeedInput } from '../../src/shared/contracts';
import { expect, test as base } from './fixtures';

const test = base.extend<{ app: ElectronApplication; page: Page }>({
  app: async ({ launchElectron }, use) => {
    await use((await launchElectron()).app);
  },

  page: async ({ app }, use) => {
    const page = await app.firstWindow();
    await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
    await use(page);
  },
});

// A social post: no image, and a feed title long enough to reach the card's right edge.
async function subscribeImagelessPost(page: Page): Promise<void> {
  await page.evaluate((payload) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', payload), {
    link: 'https://bsky.app/profile/theopnv.com/rss',
    title: '@theopnv.com - theopnv, with a feed title long enough to reach the right edge of any card',
    type: 'bluesky',
    categoryName: 'People',
    workspaceId: HOME_WORKSPACE_ID,
    showInWorkspace: true,
    items: [{
      title: 'Did you know RSS profile feeds are native on @bsky.app ?',
      guid: 'at://post/1',
      link: 'https://bsky.app/profile/theopnv.com/post/1',
      pubDate: new Date(Date.now() - 49 * 60 * 1000).toUTCString(),
      description: 'Did you know RSS profile feeds are native on @bsky.app ? Try bsky.app/profile/{your-handle}/rss. Very cool!',
      image: undefined,
      author: undefined,
      extra: undefined,
      read_at: undefined,
    }],
  } satisfies NewFeedInput);
}

async function boxOf(locator: Locator): Promise<{ x: number; y: number; width: number; height: number }> {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error('expected the element to have a layout box');
  }
  return box;
}

// The window opens maximized, so without this its width would follow whatever screen the run has.
async function resizeWindow(app: ElectronApplication, width: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, size) => {
    const window = BrowserWindow.getAllWindows()[0];
    window?.unmaximize();
    window?.setSize(size, 900);
  }, width);
}

for (const width of [1024, 1440]) {
  for (const density of ['Cards', 'Magazine', 'Compact'] as const) {
    test(`in ${density} density at ${width}px, the save button does not cover the post time on a card without an image`, async ({ app, page }) => {
    // Arrange
      await resizeWindow(app, width);
      await subscribeImagelessPost(page);
      await page.evaluate((value) => localStorage.setItem('preferences-density', JSON.stringify(value)), density);

      // Act
      await page.reload();
      await expect(page.getByText('49m', { exact: true })).toBeVisible();

      // Assert
      const save = await boxOf(page.getByRole('button', { name: 'Save', exact: true }));
      const time = await boxOf(page.getByText('49m', { exact: true }));
      const overlaps = save.x < time.x + time.width && time.x < save.x + save.width
      && save.y < time.y + time.height && time.y < save.y + save.height;
      expect(overlaps).toBe(false);
    });
  }
}
