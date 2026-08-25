import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

interface Article {
  title: string;
  link: string;
}

interface FeedServer {
  url: string;
  publish: (articles: Article[]) => void;
}

type ReadStateTestFixtures = {
  feedServer: FeedServer;
  userDataDir: string;
  launchApp: () => Promise<Page>;
};

function rss(articles: Article[]): string {
  const items = articles
    .map((article) => `<item><title>${article.title}</title><link>${article.link}</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>An article</description></item>`)
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Local feed</title><description>A local feed</description>${items}</channel></rss>`;
}

const readStateTest = base.extend<ReadStateTestFixtures>({
  feedServer: async ({}, use) => {
    let body = rss([]);
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await use({ url: `http://127.0.0.1:${port}/feed.xml`, publish: (articles) => {
        body = rss(articles); 
      } });
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

  // Every launch reuses the same user data dir, so a test can restart the app against its own database.
  launchApp: async ({ userDataDir }, use) => {
    const launched: ElectronApplication[] = [];
    try {
      await use(async () => {
        const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
        launched.push(app);
        return app.firstWindow();
      });
    } finally {
      await Promise.all(launched.map((app) => app.close()));
    }
  },
});

// Subscribes without going through the wizard. The row is enough for a refresh to find the feed.
async function subscribe(page: Page, url: string): Promise<void> {
  await page.evaluate((link) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
    link, title: 'Local feed', items: [], categoryName: 'tech', showInHome: true,
  }), url);
  await page.getByRole('button', { name: 'Refresh feeds' }).click();
}

readStateTest('an opened article is still read after a restart', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const firstRun = await launchApp();
  await subscribe(firstRun, feedServer.url);
  await expect(firstRun.getByText('First article', { exact: true })).toBeVisible();

  // Act
  await firstRun.getByText('First article', { exact: true }).click();
  await expect(firstRun.getByRole('heading', { name: 'First article' })).toBeVisible();

  // The read mark is written asynchronously behind the optimistic UI update, so wait for the
  // database to confirm it before restarting.
  await expect
    .poll(() => firstRun.evaluate(() => window.electron.ipcRenderer.invoke('feeds:list', undefined)
      .then((feeds) => feeds.some((feed) => feed.items.some((item) => Boolean(item.read_at))))))
    .toBe(true);

  const secondRun = await launchApp();

  // Assert
  const feeds = await secondRun.evaluate(() => window.electron.ipcRenderer.invoke('feeds:list', undefined));
  const item = feeds.flatMap((feed) => feed.items).find((candidate) => candidate.title === 'First article');
  expect(item?.read_at).toBeTruthy();
});
