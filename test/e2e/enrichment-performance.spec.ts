// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';
import { expect, rss, serve, test } from './fixtures';

const FEED_COUNT = 40;
const ITEMS_PER_FEED = 30;
const QUERY_BUDGET_MS = 100;
const ARTICLE_RESPONSE_DELAY_MS = 1000;

function feedXml(feedIndex: number, origin: string): string {
  const articles = Array.from({ length: ITEMS_PER_FEED }, (_, itemIndex) => ({
    title: `Feed ${feedIndex} item ${itemIndex}`,
    link: `${origin}/article/${feedIndex}/${itemIndex}`,
    description: 'Article teaser',
  }));
  return rss(articles, `Feed ${feedIndex}`);
}

test('items query stays responsive during large image enrichment', async ({ launchElectron }) => {
  // Arrange
  let articleRequests = 0;
  const server = await serve((request, response) => {
    const feedMatch = request.url?.match(/^\/feed\/(\d+)\.xml$/);
    if (feedMatch?.[1]) {
      response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      response.end(feedXml(Number(feedMatch[1]), server.origin));
      return;
    }
    if (request.url?.startsWith('/article/')) {
      articleRequests += 1;
      setTimeout(() => {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end('<html><head><meta property="og:image" content="https://example.com/image.jpg"></head><body>Article</body></html>');
      }, ARTICLE_RESPONSE_DELAY_MS);
      return;
    }
    response.writeHead(404);
    response.end();
  });

  try {
    const { page } = await launchElectron();
    const feedUrls = Array.from({ length: FEED_COUNT }, (_, feedIndex) => `${server.origin}/feed/${feedIndex}.xml`);
    await page.evaluate(async ({ feedUrls, workspaceId }) => {
      await Promise.all(feedUrls.map((link, index) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
        link,
        title: `Feed ${index}`,
        type: 'rss',
        items: [],
        categoryName: 'load test',
        workspaceId,
        showInWorkspace: true,
      })));
    }, { feedUrls, workspaceId: HOME_WORKSPACE_ID });
    await page.evaluate(() => {
      void window.electron.ipcRenderer.invoke('feeds:refresh', undefined);
    });
    await expect.poll(() => articleRequests).toBeGreaterThan(0);

    // Act
    const elapsedMs = await page.evaluate(async () => {
      const startedAt = performance.now();
      await window.electron.ipcRenderer.invoke('items:query', { workspaceId: 1, limit: 100 });
      return performance.now() - startedAt;
    });

    // Assert
    expect(elapsedMs).toBeLessThan(QUERY_BUDGET_MS);
  } finally {
    await server.close();
  }
});
