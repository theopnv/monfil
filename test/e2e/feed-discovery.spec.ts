// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';

const FIXTURE_PUB_DATE = new Date().toUTCString();

function rss(title: string): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>${title}</title><description>A local feed</description>`
    + `<item><title>${title} article</title><link>http://127.0.0.1/${encodeURIComponent(title)}</link><pubDate>${FIXTURE_PUB_DATE}</pubDate><description>An article</description></item>`
    + '</channel></rss>';
}

const PAGE = '<!doctype html><html><head><title>Local blog</title>'
  + '<link rel="alternate" type="application/rss+xml" title="Posts" href="/posts.xml">'
  + '<link rel="alternate" type="application/rss+xml" title="Comments" href="/comments.xml">'
  + '</head><body>Hello</body></html>';

type DiscoveryTestFixtures = {
  userDataDir: string;
  blogUrl: string;
  launchApp: () => Promise<Page>;
};

const discoveryTest = base.extend<DiscoveryTestFixtures>({
  userDataDir: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    try {
      await use(userDataDir);
    } finally {
      await rm(userDataDir, { recursive: true });
    }
  },

  blogUrl: async ({}, use) => {
    const server: Server = createServer((request, response) => {
      if (request.url === '/posts.xml' || request.url === '/comments.xml') {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        response.end(rss(request.url === '/posts.xml' ? 'Blog posts' : 'Blog comments'));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end(PAGE);
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    try {
      await use(`http://127.0.0.1:${port}/`);
    } finally {
      await new Promise<void>((resolve) => server.close(() => resolve()));
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

discoveryTest('a blog page link offers the feeds it advertises and subscribes to the one picked', async ({ launchApp, blogUrl }) => {
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
