// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, rss, serve, subscribe, test as base, type Article } from './fixtures';

const ARTICLE_PARAGRAPH = 'This sentence only exists in the full article page, fetched from the source, not in the feed teaser. '.repeat(6);

interface ReaderArticle extends Article {
  body?: string;
}

interface ReaderFeedServer {
  url: string;
  publish: (articles: ReaderArticle[]) => void;
}

function articlePage(title: string, body = `<p>${ARTICLE_PARAGRAPH}</p>`): string {
  return `<!doctype html><html><head><title>${title}</title></head><body>
<nav><a href="/">Home</a></nav>
<article><h1>${title}</h1>${body}</article>
<footer>Copyright</footer>
</body></html>`;
}

const test = base.extend<{ feedServer: ReaderFeedServer }>({
  feedServer: async ({}, use) => {
    let articles: ReaderArticle[] = [];
    const server = await serve((request, response) => {
      if (request.url === '/feed.xml') {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        response.end(rss(articles.map((article) => ({ ...article, description: 'Short feed teaser.' }))));
        return;
      }
      const article = articles.find((candidate) => request.url === new URL(candidate.link).pathname);
      if (article) {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(articlePage(article.title, article.body));
        return;
      }
      response.writeHead(404);
      response.end();
    });
    try {
      await use({
        url: `${server.origin}/feed.xml`,
        publish: (published) => {
          articles = published.map((article) => ({ ...article, link: `${server.origin}${article.link}` }));
        },
      });
    } finally {
      await server.close();
    }
  },
});

test('shows the fetched article body instead of the feed description', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'Full Article', link: '/article/full' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('Full Article', { exact: true })).toBeVisible();

  // Act
  await page.getByText('Full Article', { exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Full Article' })).toBeVisible();

  // Assert: the reader asks the utility process for the article after the item opens.
  await expect(page.getByTestId('article-body')).toContainText('only exists in the full article page', { timeout: 15000 });
  await expect(page.getByTestId('article-body')).not.toContainText('Short feed teaser.');
});

test('loads one provider frame only after a click', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{
    title: 'Embedded Article',
    link: '/article/embedded',
    body: `<p>${ARTICLE_PARAGRAPH}</p><figure><iframe src="https://www.youtube.com/embed/5HcjtbfJfCY" title="Video"></iframe></figure><figure><iframe src="https://player.vimeo.com/video/12345678" title="Second video"></iframe></figure><p>${ARTICLE_PARAGRAPH}</p>`,
  }]);
  const page = await launchApp();
  const requested: string[] = [];
  await page.route(/https:\/\/(www\.youtube-nocookie\.com|player\.vimeo\.com)\//, async (route) => {
    requested.push(route.request().url());
    await route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><body>Provider frame</body></html>' });
  });
  await subscribe(page, feedServer.url);

  // Act
  await page.getByText('Embedded Article', { exact: true }).click();
  await expect(page.getByRole('button', { name: 'Load YouTube' })).toBeVisible();

  // Assert
  expect(requested).toHaveLength(0);
  await expect(page.locator('[data-testid="article-body"] iframe')).toHaveCount(0);

  // Act
  await page.getByRole('button', { name: 'Load YouTube' }).click();

  // Assert
  await expect(page.frameLocator('iframe').getByText('Provider frame')).toBeVisible();
  expect(requested).toHaveLength(1);
  expect(requested[0]).toContain('www.youtube-nocookie.com');
  await expect(page.getByRole('button', { name: 'Load Vimeo' })).toBeVisible();
  const frame = page.frames().find((candidate) => candidate.url().includes('www.youtube-nocookie.com/embed/'));
  expect(frame).toBeDefined();
  expect(await frame?.evaluate(() => 'electron' in window)).toBe(false);
});
