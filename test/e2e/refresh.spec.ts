// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, rss, serve, subscribe, test as base, type FeedServer } from './fixtures';

interface RecordedRequest {
  path: string | undefined;
  userAgent: string | undefined;
  ifNoneMatch: string | undefined;
}

interface RefreshFeedServer extends FeedServer {
  requests: () => RecordedRequest[];
}

const test = base.extend<{ feedServer: RefreshFeedServer }>({
  feedServer: async ({}, use) => {
    let body = rss([]);
    let version = 0;
    let etag = '"v0"';
    const requests: RecordedRequest[] = [];
    const server = await serve((request, response) => {
      const userAgent = request.headers['user-agent'];
      const ifNoneMatchHeader = request.headers['if-none-match'];
      const ifNoneMatch = Array.isArray(ifNoneMatchHeader) ? ifNoneMatchHeader[0] : ifNoneMatchHeader;
      requests.push({
        path: request.url,
        userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
        ifNoneMatch,
      });
      if (ifNoneMatch === etag) {
        response.writeHead(304, { ETag: etag });
        response.end();
        return;
      }
      response.writeHead(200, { 'Content-Type': 'application/rss+xml', ETag: etag });
      response.end(body);
    });
    const feedServer: RefreshFeedServer = {
      url: `${server.origin}/feed.xml`,
      publish: (articles) => {
        body = rss(articles);
        version += 1;
        etag = `"v${version}"`;
      },
      requests: () => [...requests],
    };
    try {
      await use(feedServer);
    } finally {
      await server.close();
    }
  },
});

test('picks up the items published between two launches', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const firstRun = await launchApp();
  await subscribe(firstRun, feedServer.url);
  await expect(firstRun.getByText('First article', { exact: true })).toBeVisible();

  // Act
  feedServer.publish([
    { title: 'First article', link: 'http://127.0.0.1/first' },
    { title: 'Second article', link: 'http://127.0.0.1/second' },
  ]);
  const secondRun = await launchApp();

  // Assert: the launch refresh may still be in flight when the river first paints. Either the
  // initial fetch already lands after the insert (both articles show immediately), or it lands
  // first and the refresh's push raises a pill once there is something for it to protect (see
  // `useIpcBridge`) — never a pill left on screen with nothing left for it to load.
  await expect(secondRun.getByText('First article', { exact: true })).toBeVisible();
  await expect(async () => {
    const pill = secondRun.getByRole('button', { name: 'Refresh, new articles available' });
    if (await pill.isVisible()) {
      await pill.click();
    }
    await expect(secondRun.getByText('Second article', { exact: true })).toBeVisible();
  }).toPass();
});

test('the refresh button picks up the items published while the app is open', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
  feedServer.publish([
    { title: 'First article', link: 'http://127.0.0.1/first' },
    { title: 'Second article', link: 'http://127.0.0.1/second' },
  ]);

  // Act
  await page.getByRole('button', { name: 'Refresh feeds' }).click();

  // Assert
  await expect(page.getByText('Second article', { exact: true })).toBeVisible();
});

test('uses Electron networking and accepts an unchanged feed response', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'Stable article', link: 'http://127.0.0.1/stable' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('Stable article', { exact: true })).toBeVisible();

  // Act
  const summary = await page.evaluate(() => window.electron.ipcRenderer.invoke('feeds:refresh', undefined));
  if (!('perFeed' in summary)) {
    throw new Error(summary.error.message);
  }

  // Assert
  // The renderer also loads the feed icon from this server, with Chromium's own user agent.
  const requests = feedServer.requests().filter((request) => request.path === '/feed.xml');
  expect(requests.every((request) => request.userAgent?.startsWith('monfil/'))).toBe(true);
  expect(requests.some((request) => request.ifNoneMatch === undefined)).toBe(true);
  expect(requests.some((request) => request.ifNoneMatch === '"v1"')).toBe(true);
  expect(summary.perFeed).toContainEqual(expect.objectContaining({ inserted: 0 }));
  expect(summary.failedFeeds).toBeUndefined();
});
