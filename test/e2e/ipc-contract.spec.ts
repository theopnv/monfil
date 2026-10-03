// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test as base, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { NewFeedInput } from '../../src/shared/contracts';

const test = base.extend<{ appPage: Page }>({
  appPage: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-ipc-e2e-'));
    const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    try {
      const page = await app.firstWindow();
      await page.waitForURL(/\/index\.html/, { waitUntil: 'domcontentloaded' });
      await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
      await use(page);
    } finally {
      await app.close();
      await rm(userDataDir, { recursive: true });
    }
  },
});

const invalidPayload = { success: false, error: { name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' } };

test('rejects invalid workspace IDs through the preload bridge', async ({ appPage }) => {
  // Act
  const responses = await appPage.evaluate(async () => {
    return Promise.all([NaN, Infinity, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1].map((workspaceId) =>
      window.electron.ipcRenderer.invoke('feeds:list', { workspaceId })));
  });

  // Assert
  expect(responses).toEqual(Array.from({ length: 6 }, () => invalidPayload));
  await expect(appPage.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
});

test('rejects malformed feed items before storing a feed', async ({ appPage }) => {
  // Arrange
  const malformed: unknown = {
    link: 'https://example.com/feed', title: 'Invalid feed', type: 'rss',
    categoryName: '', workspaceId: 1, showInWorkspace: true,
    items: [{ title: 'Item', guid: 42, pubDate: '', description: '' }],
  };

  // Act
  const response = await appPage.evaluate((arg) =>
    window.electron.ipcRenderer.invoke('feeds:submit-add-feed', arg as NewFeedInput), malformed);
  const feeds = await appPage.evaluate(() => window.electron.ipcRenderer.invoke('feeds:list', { workspaceId: 1 }));

  // Assert
  expect(response).toEqual(invalidPayload);
  expect(feeds).toEqual([]);
});

test('rejects invalid setting values without changing preferences', async ({ appPage }) => {
  // Arrange
  const before = await appPage.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-on-launch', undefined));

  // Act
  const response = await appPage.evaluate(() =>
    window.electron.ipcRenderer.invoke('settings:set-refresh-on-launch', 'false' as unknown as boolean));
  const after = await appPage.evaluate(() => window.electron.ipcRenderer.invoke('settings:get-refresh-on-launch', undefined));

  // Assert
  expect(response).toEqual(invalidPayload);
  expect(after).toEqual(before);
});

test('stores and lists a valid feed with undefined metadata', async ({ appPage }) => {
  // Act
  const response = await appPage.evaluate(() => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
    link: 'https://example.com/feed', title: 'Valid feed', type: 'youtube',
    categoryName: 'Tech', workspaceId: 1, showInWorkspace: true,
    items: [{ title: 'Item', guid: 'item-one', link: undefined, pubDate: new Date().toISOString(), description: 'Description', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
  }));
  const feeds = await appPage.evaluate(() => window.electron.ipcRenderer.invoke('feeds:list', { workspaceId: 1 }));

  // Assert
  expect(response.success).toBe(true);
  if (!response.success) {
    throw new Error(response.error.message);
  }
  expect(response.data).toMatchObject({ title: 'Valid feed', itemCount: 1, unreadCount: 1 });
  expect(feeds).toEqual([response.data]);
});

test('opens Home for invalid workspace and Reader URLs', async ({ appPage }) => {
  for (const url of ['/workspace/NaN', '/workspace/2/reader/0', '/workspace/0/reader/1']) {
    // Act
    await appPage.evaluate((hash) => {
      location.hash = hash;
    }, url);

    // Assert
    await expect(appPage).toHaveURL(/#\/workspace\/1$/);
    await expect(appPage.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
  }
});
