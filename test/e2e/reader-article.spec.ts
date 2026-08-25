import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const ARTICLE_PARAGRAPH = 'This sentence only exists in the full article page, fetched from the source, not in the feed teaser. '.repeat(6);

interface Article {
  title: string;
  link: string;
}

interface FeedServer {
  url: string;
  publish: (articles: Article[]) => void;
}

type ReaderArticleTestFixtures = {
  feedServer: FeedServer;
  userDataDir: string;
  launchApp: () => Promise<Page>;
};

function rss(articles: Article[]): string {
  const items = articles
    .map((article) => `<item><title>${article.title}</title><link>${article.link}</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>Short feed teaser.</description></item>`)
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Local feed</title><description>A local feed</description>${items}</channel></rss>`;
}

function articlePage(title: string): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>
<nav><a href="/">Home</a></nav>
<article><h1>${title}</h1><p>${ARTICLE_PARAGRAPH}</p></article>
<footer>Copyright</footer>
</body></html>`;
}

const readerArticleTest = base.extend<ReaderArticleTestFixtures>({
  feedServer: async ({}, use) => {
    let articles: Article[] = [];
    const server = createServer((request, response) => {
      if (request.url === '/feed.xml') {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        response.end(rss(articles));
        return;
      }
      const article = articles.find((candidate) => request.url === new URL(candidate.link).pathname);
      if (article) {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(articlePage(article.title));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await use({
        url: `http://127.0.0.1:${port}/feed.xml`,
        publish: (published) => {
          articles = published.map((article) => ({ ...article, link: `http://127.0.0.1:${port}${article.link}` }));
        },
      });
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

readerArticleTest('shows the fetched article body instead of the feed description', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'Full Article', link: '/article/full' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('Full Article', { exact: true })).toBeVisible();

  // Act
  await page.getByText('Full Article', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Full Article' })).toBeVisible();

  // Assert: the extraction may already be stored from refresh, or run on demand when the
  // reader opens the item, so allow the body to catch up either way.
  await expect(page.getByTestId('article-body')).toContainText('only exists in the full article page', { timeout: 15000 });
  await expect(page.getByTestId('article-body')).not.toContainText('Short feed teaser.');
});
