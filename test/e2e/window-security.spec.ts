// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ElectronApplication } from '@playwright/test';
import { expect, rss, serve, subscribe, test as base } from './fixtures';

const ARTICLE_PARAGRAPH = 'This sentence exists so that Readability keeps the paragraph and the link inside it. '.repeat(6);

interface SecuritySite {
  feedUrl: string;
  articleUrl: string;
  linkUrl: string;
  requestedPaths: string[];
}

interface MainProcessGlobals {
  openedExternally?: string[];
}

interface CspProbeWindow {
  cspViolations: string[];
}

function articlePage(linkUrl: string): string {
  return `<!doctype html><html><head><title>Full Article</title></head><body>
<nav><a href="/">Home</a></nav>
<article><h1>Full Article</h1><p>${ARTICLE_PARAGRAPH} See <a href="${linkUrl}">elsewhere</a> for more.</p></article>
<footer>Copyright</footer>
</body></html>`;
}

const test = base.extend<{ site: SecuritySite }>({
  site: async ({}, use) => {
    const requestedPaths: string[] = [];
    const server = await serve((request, response) => {
      requestedPaths.push(request.url ?? '');
      if (request.url === '/feed.xml') {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        response.end(rss([{ title: 'Full Article', link: `${server.origin}/article`, description: 'Short feed teaser.' }]));
        return;
      }
      if (request.url === '/article') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(articlePage(`${server.origin}/elsewhere`));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><html><body><p>Elsewhere</p></body></html>');
    });
    const site: SecuritySite = {
      feedUrl: `${server.origin}/feed.xml`,
      articleUrl: `${server.origin}/article`,
      linkUrl: `${server.origin}/elsewhere`,
      requestedPaths,
    };
    try {
      await use(site);
    } finally {
      await server.close();
    }
  },
});

// Replaces shell.openExternal in the main process so a link never reaches the real browser
// during the run, and records what the app tried to open.
async function stubOpenExternal(app: ElectronApplication): Promise<void> {
  await app.evaluate(({ shell }) => {
    const opened: string[] = [];
    (globalThis as MainProcessGlobals).openedExternally = opened;
    shell.openExternal = ((url: string) => {
      opened.push(url);
      return Promise.resolve();
    }) as typeof shell.openExternal;
  });
}

function openedExternally(app: ElectronApplication): Promise<string[]> {
  return app.evaluate(() => (globalThis as MainProcessGlobals).openedExternally ?? []);
}

function windowCount(app: ElectronApplication): Promise<number> {
  return app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
}

test('middle-clicking an article link opens it in the browser, not in a new window', async ({ site, launchElectron }) => {
  // Arrange
  const { app, page } = await launchElectron();
  await stubOpenExternal(app);
  await subscribe(page, site.feedUrl);
  await page.getByText('Full Article', { exact: true }).click();
  const link = page.getByTestId('article-body').getByRole('link', { name: 'elsewhere' });
  await expect(link).toBeVisible({ timeout: 15000 });

  // Act
  await link.click({ button: 'middle' });

  // Assert
  await expect.poll(() => openedExternally(app)).toEqual([site.linkUrl]);
  expect(await windowCount(app)).toBe(1);
});

test('the window refuses to navigate away from the app', async ({ site, launchElectron }) => {
  // Arrange
  const { page } = await launchElectron();
  await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
  const appUrl = page.url();
  const navigation = page.waitForEvent('framenavigated', { timeout: 1500 }).then(() => 'navigated', () => 'stayed');

  // Act
  await page.evaluate((url) => {
    location.assign(url);
  }, site.articleUrl);

  // Assert
  expect(await navigation).toBe('stayed');
  expect(page.url()).toBe(appUrl);
  expect(site.requestedPaths).not.toContain('/article');
});

test('web permissions are denied', async ({ launchElectron }) => {
  // Arrange
  const { page } = await launchElectron();

  // Act
  const permission = await page.evaluate(() => Notification.requestPermission());

  // Assert
  expect(permission).toBe('denied');
});

test('inline scripts do not run', async ({ launchElectron }) => {
  // Arrange
  const { page } = await launchElectron();

  // Act
  const ran = await page.evaluate(() => {
    const script = document.createElement('script');
    script.textContent = 'document.documentElement.dataset.inlineScriptRan = "yes"';
    document.head.append(script);
    return document.documentElement.dataset['inlineScriptRan'] === 'yes';
  });

  // Assert
  expect(ran).toBe(false);
});

test('the app renders under its content security policy without a violation', async ({ launchElectron }) => {
  // Arrange: the listener has to exist before the document loads, so it is installed for the next navigation.
  const { page } = await launchElectron();
  await page.addInitScript(() => {
    const probe = window as unknown as CspProbeWindow;
    probe.cspViolations = [];
    document.addEventListener('securitypolicyviolation', (event) => {
      probe.cspViolations.push(`${event.violatedDirective} ${event.blockedURI}`);
    });
  });

  // Act
  await page.reload();
  await page.getByRole('button', { name: 'Add feed', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Add a feed' })).toBeVisible();

  // Assert
  const violations = await page.evaluate(() => (window as unknown as CspProbeWindow).cspViolations);
  expect(violations).toEqual([]);
});
