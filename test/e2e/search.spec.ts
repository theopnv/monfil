import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

interface Article {
  title: string;
  link: string;
  description: string;
}

interface FeedServer {
  url: string;
  publish: (articles: Article[]) => void;
}

type SearchTestFixtures = {
  feedServer: FeedServer;
  userDataDir: string;
  launchApp: () => Promise<Page>;
};

function rss(articles: Article[]): string {
  const items = articles
    .map((article) => `<item><title>${article.title}</title><link>${article.link}</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>${article.description}</description></item>`)
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>River search feed</title><description>A river search feed</description>${items}</channel></rss>`;
}

const searchTest = base.extend<SearchTestFixtures>({
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

searchTest('search filters river items by title and clears with Escape', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([
    { title: 'Rust async runtime', link: 'http://127.0.0.1/rust', description: 'A deep dive into executors' },
    { title: 'TypeScript generics', link: 'http://127.0.0.1/ts', description: 'Compiler internals explained' },
    { title: 'Cooking pasta', link: 'http://127.0.0.1/pasta', description: 'Salt the water well' },
  ]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  const search = page.getByRole('textbox', { name: 'Search everything' });

  // Act
  await search.fill('pasta');

  // Assert
  await expect(page.getByText('Cooking pasta', { exact: true })).toBeVisible();
  await expect(page.getByText('Rust async runtime', { exact: true })).not.toBeVisible();
  await expect(page.getByText('TypeScript generics', { exact: true })).not.toBeVisible();

  // Act: Escape restores every item.
  await search.press('Escape');

  // Assert
  await expect(page.getByText('Cooking pasta', { exact: true })).toBeVisible();
  await expect(page.getByText('Rust async runtime', { exact: true })).toBeVisible();
  await expect(page.getByText('TypeScript generics', { exact: true })).toBeVisible();
});

searchTest('search matches the feed name and surfaces its items', async ({ feedServer, launchApp }) => {
  // Arrange: "local" appears in no article title or description, only in the feed title.
  feedServer.publish([
    { title: 'Rust async runtime', link: 'http://127.0.0.1/rust', description: 'A deep dive into executors' },
    { title: 'TypeScript generics', link: 'http://127.0.0.1/ts', description: 'Compiler internals explained' },
  ]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  const search = page.getByRole('textbox', { name: 'Search everything' });

  // Act
  await search.fill('local');

  // Assert
  await expect(page.getByText('Rust async runtime', { exact: true })).toBeVisible();
  await expect(page.getByText('TypeScript generics', { exact: true })).toBeVisible();
});

searchTest('search over the description shows a no-results message when nothing matches', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([
    { title: 'Rust async runtime', link: 'http://127.0.0.1/rust', description: 'A deep dive into executors' },
  ]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  const search = page.getByRole('textbox', { name: 'Search everything' });

  // Act
  await search.fill('executors kubernetes');

  // Assert: scoped to the <p>, since the same copy is also mirrored into the
  // visually-hidden aria-live region for screen readers.
  await expect(page.getByText('No results for "executors kubernetes"', { exact: true }).and(page.locator('p'))).toBeVisible();
  await expect(page.getByText('Rust async runtime', { exact: true })).not.toBeVisible();
});
