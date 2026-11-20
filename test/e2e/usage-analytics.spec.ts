// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Page } from '@playwright/test';
import { expect, serve, test as base } from './fixtures';

interface Received {
  headers: Record<string, string | string[] | undefined>;
  body: string;
  events: { eventName: string; sessionId: string; props?: Record<string, unknown> }[];
}

const FEED_TITLE = 'Private reading list';
const ARTICLE_TITLE = 'Secret article title';
const ARTICLE_LINK = 'http://127.0.0.1:9/secret-path';

const test = base.extend<{ received: Received[]; appPage: Page }>({
  received: async ({}, use) => {
    const received: Received[] = [];
    const server = await serve((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        received.push({ headers: request.headers, body, events: JSON.parse(body) as Received['events'] });
        response.writeHead(200).end('{}');
      });
    });
    (received as unknown as { url: string }).url = `${server.origin}/api/v0/events`;
    try {
      await use(received);
    } finally {
      await server.close();
    }
  },

  appPage: async ({ received, launchElectron }, use) => {
    const { page } = await launchElectron({
      env: { MONFIL_ANALYTICS_ENDPOINT: (received as unknown as { url: string }).url, MONFIL_ANALYTICS_FLUSH_MS: '200' },
    });
    await page.waitForURL(/\/index\.html/, { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
    await use(page);
  },
});

async function addFeedAndOpenArticle(page: Page): Promise<void> {
  await page.evaluate(async ({ feedTitle, articleTitle, link }) => {
    await window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
      link: 'http://127.0.0.1:9/feed.xml', title: feedTitle, type: 'rss', categoryName: 'Tech', workspaceId: 1, showInWorkspace: true,
      items: [{ title: articleTitle, guid: 'one', link, pubDate: new Date().toISOString(), description: 'Body', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
    });
    const page = await window.electron.ipcRenderer.invoke('items:query', { workspaceId: 1, limit: 10 });
    const row = (page as { rows: { id: number }[] }).rows[0];
    await window.electron.ipcRenderer.invoke('items:get-content', row?.id ?? 0);
  }, { feedTitle: FEED_TITLE, articleTitle: ARTICLE_TITLE, link: ARTICLE_LINK });
}

test('sends nothing before the user agrees, nothing after they refuse, then one summary after they agree', async ({ appPage, received }) => {
  // Arrange
  await addFeedAndOpenArticle(appPage);

  // Act
  await appPage.waitForTimeout(1500);

  // Assert
  expect(received).toHaveLength(0);

  // Act
  await appPage.evaluate(() => window.electron.ipcRenderer.invoke('settings:set', { key: 'usageAnalytics', value: 'denied' }));
  await appPage.evaluate(() => window.electron.ipcRenderer.invoke('items:get-content', 1));
  await appPage.waitForTimeout(1500);

  // Assert
  expect(received).toHaveLength(0);

  // Act
  await appPage.evaluate(() => window.electron.ipcRenderer.invoke('settings:set', { key: 'usageAnalytics', value: 'granted' }));
  await expect.poll(() => received.some((request) => request.events.some((event) => event.eventName === 'consent_granted'))).toBe(true);
  await appPage.evaluate(() => window.electron.ipcRenderer.invoke('items:get-content', 1));
  await expect.poll(() => received.some((request) => request.events.some((event) => event.eventName === 'daily_summary'))).toBe(true);

  // Assert
  const summaryRequest = received.find((request) => request.events.some((event) => event.eventName === 'daily_summary'));
  const summary = summaryRequest?.events.find((event) => event.eventName === 'daily_summary');
  expect(summaryRequest?.headers['app-key']).toBeTruthy();
  expect(summary?.props).toMatchObject({ articles_opened: 1, feeds_bucket: '1-5', workspaces_count: 1, feed_kinds: 'rss', feeds_added: 0 });
  for (const request of received) {
    expect(request.body).not.toContain(FEED_TITLE);
    expect(request.body).not.toContain(ARTICLE_TITLE);
    expect(request.body).not.toContain('secret-path');
  }
});
