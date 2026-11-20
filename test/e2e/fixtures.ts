// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer, type RequestListener } from 'node:http';
import type { AddressInfo } from 'node:net';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { HOME_WORKSPACE_ID, type FeedSummary, type SourceType } from '../../src/shared/contracts';

export { expect };

export const PUB_DATE = new Date().toUTCString();

export interface Article {
  title: string;
  link: string;
  description?: string;
}

export interface FeedServer {
  url: string;
  publish: (articles: Article[]) => void;
}

export interface LocalServer {
  origin: string;
  close: () => Promise<void>;
}

export interface Launched {
  app: ElectronApplication;
  page: Page;
}

export interface LaunchOptions {
  /** Defaults to the `userDataDir` fixture. */
  userDataDir?: string;
  /** Added to the environment of the test run. */
  env?: Record<string, string>;
}

export function rss(articles: Article[], channelTitle = 'Local feed'): string {
  const items = articles
    .map((article) => `<item><title>${article.title}</title><link>${article.link}</link><pubDate>${PUB_DATE}</pubDate><description>${article.description ?? 'An article'}</description></item>`)
    .join('');
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>${channelTitle}</title><description>A local feed</description>${items}</channel></rss>`;
}

/** Starts an HTTP server on a free loopback port. `close` drops the connections that the app still holds open, so it does not wait for the app to quit. */
export async function serve(handler: RequestListener): Promise<LocalServer> {
  const server = createServer(handler);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => {
      server.close(() => resolve());
      server.closeAllConnections();
    }),
  };
}

type Fixtures = {
  feedServer: FeedServer;
  userDataDir: string;
  /** Opens the app on the profile of the test. A second call closes the first instance: two Electron processes on one profile race over the profile's lock files. */
  launchElectron: (options?: LaunchOptions) => Promise<Launched>;
  launchApp: () => Promise<Page>;
};

function withEnv(env: Record<string, string>): Record<string, string> {
  const inherited = Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined);
  return { ...Object.fromEntries(inherited), ...env };
}

const closeQuietly = (app: ElectronApplication | undefined) => app?.close().catch(() => undefined);

export const test = base.extend<Fixtures>({
  feedServer: async ({}, use) => {
    let body = rss([]);
    const server = await serve((_request, response) => {
      response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
      response.end(body);
    });
    try {
      await use({
        url: `${server.origin}/feed.xml`,
        publish: (articles) => {
          body = rss(articles);
        },
      });
    } finally {
      await server.close();
    }
  },

  userDataDir: async ({}, use) => {
    const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-'));
    try {
      await use(userDataDir);
    } finally {
      await rm(userDataDir, { recursive: true, force: true });
    }
  },

  launchElectron: async ({ userDataDir }, use) => {
    const running = new Map<string, ElectronApplication>();
    try {
      await use(async (options = {}) => {
        const dir = options.userDataDir ?? userDataDir;
        await closeQuietly(running.get(dir));
        const app = await electron.launch({
          args: ['.', `--user-data-dir=${dir}`],
          ...(options.env && { env: withEnv(options.env) }),
        });
        running.set(dir, app);
        return { app, page: await app.firstWindow() };
      });
    } finally {
      await Promise.all([...running.values()].map(closeQuietly));
    }
  },

  launchApp: async ({ launchElectron }, use) => {
    await use(async () => (await launchElectron()).page);
  },
});

/** Adds a feed row over IPC, without the wizard and without a network fetch. */
export async function addFeed(page: Page, feed: { link: string; title?: string; type?: SourceType; categoryName?: string; workspaceId?: number }) {
  return page.evaluate((payload) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', payload), {
    link: feed.link,
    title: feed.title ?? 'Local feed',
    type: feed.type ?? 'rss',
    items: [],
    categoryName: feed.categoryName ?? 'tech',
    workspaceId: feed.workspaceId ?? HOME_WORKSPACE_ID,
    showInWorkspace: true,
  });
}

/** Adds the feed row and refreshes. The row is enough for a refresh to find the feed. */
export async function subscribe(page: Page, url: string, type: SourceType = 'rss'): Promise<void> {
  await addFeed(page, { link: url, type });
  await page.getByRole('button', { name: 'Refresh feeds' }).click();
}

/** Adds the feed row, then reloads: only the add-feed wizard invalidates the feed query, and this writes behind its back. */
export async function subscribeAndReload(page: Page, link: string, title: string, categoryName: string, workspaceId = HOME_WORKSPACE_ID): Promise<void> {
  await addFeed(page, { link, title, categoryName, workspaceId });
  await page.reload();
}

export async function feedIdFor(page: Page, link: string): Promise<number> {
  const feeds = await page.evaluate((workspaceId) => window.electron.ipcRenderer.invoke('feeds:list', { workspaceId }), HOME_WORKSPACE_ID) as FeedSummary[];
  const feed = feeds.find((candidate) => candidate.link === link);
  if (!feed) {
    throw new Error(`expected a feed for ${link}`);
  }
  return feed.id;
}
