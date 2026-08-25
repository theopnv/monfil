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

type ScrollRestorationTestFixtures = {
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

const scrollRestorationTest = base.extend<ScrollRestorationTestFixtures>({
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
    link, title: 'Local feed', items: [], categoryName: 'tech', showInHome: true,
  }), url);
  await page.getByRole('button', { name: 'Refresh feeds' }).click();
}

// The river's scroll container is the only `.flex-1.overflow-y-auto` element on the home route;
// the feed sidebar next to it also scrolls, but is `w-64 flex-none` instead.
const riverScrollContainer = (page: Page) => page.locator('.flex-1.overflow-y-auto');

scrollRestorationTest('keeps the river scroll position after returning from the reader', async ({ feedServer, launchApp }) => {
  // Arrange: fetchFeed caps a single refresh at 30 items, so that is the largest river this test can fill.
  const articles = Array.from({ length: 30 }, (_, index) => ({
    title: `Article number ${index}`,
    link: `http://127.0.0.1/article-${index}`,
  }));
  feedServer.publish(articles);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('Article number 0', { exact: true })).toBeVisible();
  await expect(page.getByText('Article number 29', { exact: true })).toBeAttached();

  // Act: Playwright's `.click()` scrolls its target into view first, which would itself move
  // the river before navigation. Dispatch DOM clicks instead, so the scroll position set below
  // is exactly what's still in place when the reader opens.
  await riverScrollContainer(page).evaluate((element) => {
    element.scrollTop = 800; 
  });
  await expect.poll(() => riverScrollContainer(page).evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const scrollTopBeforeLeaving = await riverScrollContainer(page).evaluate((element) => element.scrollTop);

  await page.getByText('Article number 15', { exact: true }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByRole('heading', { name: 'Article number 15' })).toBeVisible();
  await page.getByRole('button', { name: 'Home' }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByText('Article number 0', { exact: true })).toBeVisible();

  // Assert
  await expect.poll(() => riverScrollContainer(page).evaluate((element) => element.scrollTop)).toBe(scrollTopBeforeLeaving);
});
