// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';
import { expect, test as base } from './fixtures';

const HINT_TEXT = {
  addFeed: 'Add a feed here. To delete a feed, right-click it.',
  filter: 'Click a feed to show only its articles. Click the eye to hide a feed.',
  save: 'Save an article with the bookmark. Find your saved articles here.',
  workspace: 'Create a workspace to group feeds. Right-click a workspace to edit or delete it.',
};

const test = base.extend<{ feedUrl: string }>({
  feedUrl: async ({ feedServer }, use) => {
    feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
    await use(feedServer.url);
  },

  // playwright.config.ts turns hints off for every other spec; this one opts back in.
  launchApp: async ({ launchElectron }, use) => {
    await use(async () => (await launchElectron({ env: { MONFIL_HINTS: 'on' } })).page);
  },
});

test('hints appear one at a time, "Got it" moves to the next one, and a relaunch keeps them closed', async ({ feedUrl, launchApp }) => {
  // Arrange
  const page = await launchApp();
  const gotIt = page.getByRole('button', { name: 'Got it', exact: true });
  // The hint that was just closed stays mounted while it fades out.
  const dismissOpenHint = async () => {
    await expect(gotIt).toHaveCount(1);
    await gotIt.click();
  };

  // Assert: a fresh profile starts with the add-feed hint only.
  await expect(page.getByText(HINT_TEXT.addFeed)).toBeVisible();
  await expect(page.getByText(HINT_TEXT.workspace)).not.toBeVisible();

  // Act
  await dismissOpenHint();

  // Assert: the filter hint waits for a feed, and the hints behind it wait for the filter hint.
  await expect(page.getByText(HINT_TEXT.addFeed)).not.toBeVisible();
  await expect(page.getByText(HINT_TEXT.workspace)).not.toBeVisible();

  // Act
  await page.evaluate(({ link, workspaceId }) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
    link, title: 'Local feed', type: 'rss', items: [], categoryName: 'tech', workspaceId, showInWorkspace: true,
  }), { link: feedUrl, workspaceId: HOME_WORKSPACE_ID });
  await page.reload();

  // Assert
  await expect(page.getByText(HINT_TEXT.filter)).toBeVisible();

  // Act
  await dismissOpenHint();

  // Assert
  await expect(page.getByText(HINT_TEXT.save)).toBeVisible();

  // Act
  await dismissOpenHint();

  // Assert
  await expect(page.getByText(HINT_TEXT.workspace)).toBeVisible();

  // Act
  await dismissOpenHint();
  const relaunched = await launchApp();

  // Assert: the first-run check already ran, and nothing opens again.
  await expect.poll(() => relaunched.evaluate(() => localStorage.getItem('hints-state'))).toContain('"initialized":true');
  await expect(relaunched.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
  for (const text of Object.values(HINT_TEXT)) {
    await expect(relaunched.getByText(text)).not.toBeVisible();
  }
});

test('the add-feed hint stays closed after a relaunch once it was dismissed', async ({ launchApp }) => {
  // Arrange
  const page = await launchApp();
  await expect(page.getByText(HINT_TEXT.addFeed)).toBeVisible();

  // Act
  await page.getByRole('button', { name: 'Got it', exact: true }).click();
  const relaunched = await launchApp();

  // Assert
  await expect.poll(() => relaunched.evaluate(() => localStorage.getItem('hints-state'))).toContain('"add-feed"');
  await expect(relaunched.getByText(HINT_TEXT.addFeed)).not.toBeVisible();
});
