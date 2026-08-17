import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import type { Feed } from '../../src/preload/channels';

interface Article {
  title: string;
  link: string;
}

interface FeedServer {
  url: string;
  publish: (articles: Article[]) => void;
}

type DeleteFeedTestFixtures = {
  feedServer: FeedServer;
  userDataDir: string;
  launchApp: () => Promise<{ app: ElectronApplication; page: Page }>;
};

function rss(articles: Article[]): string {
  const items = articles
    .map((article) => `<item><title>${article.title}</title><link>${article.link}</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>An article</description></item>`)
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Local feed</title><description>A local feed</description>${items}</channel></rss>`;
}

const deleteFeedTest = base.extend<DeleteFeedTestFixtures>({
  feedServer: async ({}, use) => {
    let body = rss([]);
    const server = createServer((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      response.end(body);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await use({ url: `http://127.0.0.1:${port}/feed.xml`, publish: (articles) => { body = rss(articles); } });
    } finally {
      await new Promise<void>((resolve) => server.close(() => { resolve(); }));
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
        return { app, page: await app.firstWindow() };
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

async function feedIdFor(page: Page, link: string): Promise<number> {
  const feeds = await page.evaluate(() => window.electron.ipcRenderer.invoke('feeds:list', undefined)) as Feed[];
  const feed = feeds.find((candidate) => candidate.link === link);
  if (!feed) throw new Error(`expected a feed for ${link}`);
  return feed.id;
}

deleteFeedTest('confirming the dialog removes the feed and its items, even after a restart', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const { app, page } = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
  const feedId = await feedIdFor(page, feedServer.url);

  // Act: stand in for the native menu's click, which Playwright cannot drive.
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('feeds:delete-feed-requested', id);
  }, feedId);
  await expect(page.getByRole('heading', { name: 'Delete feed' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete feed' }).click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Delete feed' })).not.toBeVisible();
  await expect(page.getByText('First article', { exact: true })).not.toBeVisible();

  // Act: relaunch against the same user data dir.
  const relaunched = await launchApp();

  // Assert
  await expect(relaunched.page.getByText('First article', { exact: true })).not.toBeVisible();
});

deleteFeedTest('cancelling the dialog leaves the feed in place', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const { app, page } = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
  const feedId = await feedIdFor(page, feedServer.url);

  // Act
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('feeds:delete-feed-requested', id);
  }, feedId);
  await expect(page.getByRole('heading', { name: 'Delete feed' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Delete feed' })).not.toBeVisible();
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
});
