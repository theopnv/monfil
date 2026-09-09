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

type FeedVisibilityTestFixtures = {
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

const feedVisibilityTest = base.extend<FeedVisibilityTestFixtures>({
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

// The folder's open state is saved to localStorage, so a relaunch against the same user data
// dir can start with it already expanded.
async function ensureFolderOpen(page: Page): Promise<void> {
  const row = page.getByRole('button', { name: /Local feed/ });
  if (!(await row.isVisible())) {
    await page.getByRole('button', { name: 'tech', exact: true }).click();
  }
}

feedVisibilityTest('rotating a feed row to hidden removes it from home and survives a relaunch', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
  await ensureFolderOpen(page);
  const row = page.getByRole('button', { name: /Local feed/ });

  // Act: rotate the row home -> only -> hidden.
  await row.click();
  await expect(row).toHaveAttribute('data-visibility', 'only');
  await row.click();

  // Assert
  await expect(row).toHaveAttribute('data-visibility', 'hidden');
  await expect(page.getByText('First article', { exact: true })).not.toBeVisible();

  // Act: relaunch against the same user data dir.
  const relaunched = await launchApp();

  // Assert: the hide persisted, but the row is not stuck in a session-only "only" state.
  await expect(relaunched.getByText('First article', { exact: true })).not.toBeVisible();
  await ensureFolderOpen(relaunched);
  await expect(relaunched.getByRole('button', { name: /Local feed/ })).toHaveAttribute('data-visibility', 'hidden');
});
