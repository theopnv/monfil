// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';

type HintsTestFixtures = {
  feedUrl: string;
  userDataDir: string;
  launchApp: () => Promise<Page>;
};

const FEED_BODY = `<?xml version="1.0"?><rss version="2.0"><channel><title>Local feed</title><description>A local feed</description><item><title>First article</title><link>http://127.0.0.1/first</link><pubDate>${new Date().toUTCString()}</pubDate><description>An article</description></item></channel></rss>`;

const HINT_TEXT = {
  addFeed: 'Add a feed here. To delete a feed, right-click it.',
  filter: 'Click a feed to show only its articles. Click the eye to hide a feed.',
  save: 'Save an article with the bookmark. Find your saved articles here.',
  workspace: 'Create a workspace to group feeds. Right-click a workspace to edit or delete it.',
};

const hintsTest = base.extend<HintsTestFixtures>({
  feedUrl: async ({}, use) => {
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      response.end(FEED_BODY);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await use(`http://127.0.0.1:${port}/feed.xml`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => {
        resolve();
      }));
    }
  },

  userDataDir: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    try {
      await use(userDataDir);
    } finally {
      await rm(userDataDir, { recursive: true });
    }
  },

  // playwright.config.ts turns hints off for every other spec; this one opts back in.
  launchApp: async ({ userDataDir }, use) => {
    let current: ElectronApplication | undefined;
    try {
      await use(async () => {
        await current?.close();
        const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
        const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`], env: { ...env, MONFIL_HINTS: 'on' } });
        current = app;
        return app.firstWindow();
      });
    } finally {
      await current?.close();
    }
  },
});

hintsTest('hints appear one at a time, "Got it" moves to the next one, and a relaunch keeps them closed', async ({ feedUrl, launchApp }) => {
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

hintsTest('the add-feed hint stays closed after a relaunch once it was dismissed', async ({ launchApp }) => {
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
