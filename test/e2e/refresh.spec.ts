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

type RefreshTestFixtures = {
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

const refreshTest = base.extend<RefreshTestFixtures>({
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
    link, title: 'Local feed', type: 'rss', items: [], categoryName: 'tech', showInHome: true,
  }), url);
  await page.getByRole('button', { name: 'Refresh feeds' }).click();
}

refreshTest('picks up the items published between two launches', async ({ feedServer, launchApp }) => {
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

  // Assert: "Second article" only appears once the second launch's own refresh-on-launch cycle has
  // fetched over the network and written to the database, on top of a full second Electron process
  // boot. Windows CI leaves much less headroom for that than the single-process "click refresh"
  // path below, or than Linux/macOS (matches the process/file-handle slowness already seen for
  // better-sqlite3's native module elsewhere in this repo's Windows CI).
  await expect(secondRun.getByText('Second article', { exact: true })).toBeVisible({ timeout: 15000 });
  await expect(secondRun.getByText('First article', { exact: true })).toBeVisible();
});

refreshTest('the refresh button picks up the items published while the app is open', async ({ feedServer, launchApp }) => {
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
