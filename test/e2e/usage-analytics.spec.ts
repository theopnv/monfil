// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test as base, expect, _electron as electron, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

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
    const server = createServer((request, response) => {
      const chunks: Buffer[] = [];
      request.on('data', (chunk: Buffer) => chunks.push(chunk));
      request.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        received.push({ headers: request.headers, body, events: JSON.parse(body) as Received['events'] });
        response.writeHead(200).end('{}');
      });
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    (received as unknown as { url: string }).url = `http://127.0.0.1:${port}/api/v0/events`;
    try {
      await use(received);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
    }
  },

  appPage: async ({ received }, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-analytics-e2e-'));
    const env = Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined));
    const app = await electron.launch({
      args: ['.', `--user-data-dir=${userDataDir}`],
      env: { ...env, MONFIL_ANALYTICS_ENDPOINT: (received as unknown as { url: string }).url, MONFIL_ANALYTICS_FLUSH_MS: '200' },
    });
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
  await appPage.evaluate(() => window.electron.ipcRenderer.invoke('settings:set-usage-analytics', 'denied'));
  await appPage.evaluate(() => window.electron.ipcRenderer.invoke('items:get-content', 1));
  await appPage.waitForTimeout(1500);

  // Assert
  expect(received).toHaveLength(0);

  // Act
  await appPage.evaluate(() => window.electron.ipcRenderer.invoke('settings:set-usage-analytics', 'granted'));
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
