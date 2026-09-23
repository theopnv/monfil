import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';

const FIXTURE_PUB_DATE = new Date().toUTCString();

const FEED_COUNT = 40;
const ITEMS_PER_FEED = 30;
const QUERY_BUDGET_MS = 100;
const ARTICLE_RESPONSE_DELAY_MS = 1000;

function rss(feedIndex: number, port: number): string {
  const items = Array.from({ length: ITEMS_PER_FEED }, (_, itemIndex) => {
    const link = `http://127.0.0.1:${port}/article/${feedIndex}/${itemIndex}`;
    return `<item><title>Feed ${feedIndex} item ${itemIndex}</title><link>${link}</link><pubDate>${FIXTURE_PUB_DATE}</pubDate><description>Article teaser</description></item>`;
  }).join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Feed ${feedIndex}</title><description>Load test feed</description>${items}</channel></rss>`;
}

test('items query stays responsive during large image enrichment', async () => {
  // Arrange
  let articleRequests = 0;
  const server = createServer((request, response) => {
    const feedMatch = request.url?.match(/^\/feed\/(\d+)\.xml$/);
    if (feedMatch?.[1]) {
      response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      response.end(rss(Number(feedMatch[1]), (server.address() as AddressInfo).port));
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
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-enrichment-'));

  try {
    const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    try {
      const page = await app.firstWindow();
      const feedUrls = Array.from({ length: FEED_COUNT }, (_, feedIndex) => `http://127.0.0.1:${port}/feed/${feedIndex}.xml`);
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
      await app.close();
    }
  } finally {
    await new Promise<void>((resolve) => server.close(() => {
      resolve();
    }));
    await rm(userDataDir, { recursive: true });
  }
});
