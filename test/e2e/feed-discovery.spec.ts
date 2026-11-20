// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, rss, serve, test as base } from './fixtures';

const PAGE = '<!doctype html><html><head><title>Local blog</title>'
  + '<link rel="alternate" type="application/rss+xml" title="Posts" href="/posts.xml">'
  + '<link rel="alternate" type="application/rss+xml" title="Comments" href="/comments.xml">'
  + '</head><body>Hello</body></html>';

const test = base.extend<{ blogUrl: string }>({
  blogUrl: async ({}, use) => {
    const server = await serve((request, response) => {
      if (request.url === '/posts.xml' || request.url === '/comments.xml') {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        const name = request.url === '/posts.xml' ? 'Blog posts' : 'Blog comments';
        response.end(rss([{ title: `${name} article`, link: `http://127.0.0.1/${encodeURIComponent(name)}` }], name));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(PAGE);
    });
    try {
      await use(`${server.origin}/`);
    } finally {
      await server.close();
    }
  },
});

test('a blog page link offers the feeds it advertises and subscribes to the one picked', async ({ launchApp, blogUrl }) => {
  // Arrange
  const page = await launchApp();
  await page.getByRole('button', { name: 'Add feed', exact: true }).click();

  // Act
  await page.getByLabel('Feed URL').fill(blogUrl);
  await expect(page.getByText('2 feeds found. Pick one.')).toBeVisible();
  await page.locator('label', { hasText: 'Blog comments' }).click();
  await expect(page.getByRole('radio', { name: /Blog comments/ })).toBeChecked();
  await page.getByRole('button', { name: 'Continue' }).click();
  await page.getByRole('button', { name: '+ New category' }).click();
  await page.getByLabel('New category name').fill('Blogs');
  await page.getByRole('button', { name: 'Add', exact: true }).click();
  await page.getByRole('button', { name: 'Add source' }).click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Blog comments is in Blogs' })).toBeVisible();
  await expect(page.getByRole('dialog').getByText('Blog comments article')).toBeVisible();
});
