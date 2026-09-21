import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { HOME_WORKSPACE_ID } from '../../src/preload/channels';

const ARTICLE_PARAGRAPH = 'This sentence exists so that Readability keeps the paragraph and the link inside it. '.repeat(6);

interface FeedServer {
  feedUrl: string;
  articleUrl: string;
  linkUrl: string;
  requestedPaths: string[];
}

type WindowSecurityTestFixtures = {
  feedServer: FeedServer;
  userDataDir: string;
  launchApp: () => Promise<{ app: ElectronApplication; page: Page }>;
};

interface MainProcessGlobals {
  openedExternally?: string[];
}

interface CspProbeWindow {
  cspViolations: string[];
}

function rss(articleUrl: string): string {
  return `<?xml version="1.0"?><rss version="2.0"><channel><title>Local feed</title><description>A local feed</description>`
    + `<item><title>Full Article</title><link>${articleUrl}</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate><description>Short feed teaser.</description></item>`
    + `</channel></rss>`;
}

function articlePage(linkUrl: string): string {
  return `<!doctype html><html><head><title>Full Article</title></head><body>
<nav><a href="/">Home</a></nav>
<article><h1>Full Article</h1><p>${ARTICLE_PARAGRAPH} See <a href="${linkUrl}">elsewhere</a> for more.</p></article>
<footer>Copyright</footer>
</body></html>`;
}

const windowSecurityTest = base.extend<WindowSecurityTestFixtures>({
  feedServer: async ({}, use) => {
    const requestedPaths: string[] = [];
    let origin = '';
    const server = createServer((request, response) => {
      requestedPaths.push(request.url ?? '');
      if (request.url === '/feed.xml') {
        response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
        response.end(rss(`${origin}/article`));
        return;
      }
      if (request.url === '/article') {
        response.writeHead(200, { 'Content-Type': 'text/html' });
        response.end(articlePage(`${origin}/elsewhere`));
        return;
      }
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><html><body><p>Elsewhere</p></body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    origin = `http://127.0.0.1:${port}`;
    try {
      await use({
        feedUrl: `${origin}/feed.xml`,
        articleUrl: `${origin}/article`,
        linkUrl: `${origin}/elsewhere`,
        requestedPaths,
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
        return { app, page: await app.firstWindow() };
      });
    } finally {
      await Promise.all(launched.map((app) => app.close()));
    }
  },
});

// Subscribes without going through the wizard. The row is enough for a refresh to find the feed.
async function subscribe(page: Page, url: string): Promise<void> {
  await page.evaluate(({ link, workspaceId }) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
    link, title: 'Local feed', type: 'rss', items: [], categoryName: 'tech', workspaceId, showInWorkspace: true,
  }), { link: url, workspaceId: HOME_WORKSPACE_ID });
  await page.getByRole('button', { name: 'Refresh feeds' }).click();
}

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

windowSecurityTest('middle-clicking an article link opens it in the browser, not in a new window', async ({ feedServer, launchApp }) => {
  // Arrange
  const { app, page } = await launchApp();
  await stubOpenExternal(app);
  await subscribe(page, feedServer.feedUrl);
  await page.getByText('Full Article', { exact: true }).click();
  const link = page.getByTestId('article-body').getByRole('link', { name: 'elsewhere' });
  await expect(link).toBeVisible({ timeout: 15000 });

  // Act
  await link.click({ button: 'middle' });

  // Assert
  await expect.poll(() => openedExternally(app)).toEqual([feedServer.linkUrl]);
  expect(await windowCount(app)).toBe(1);
});

windowSecurityTest('the window refuses to navigate away from the app', async ({ feedServer, launchApp }) => {
  // Arrange
  const { page } = await launchApp();
  await expect(page.getByRole('button', { name: 'Add feed', exact: true })).toBeVisible();
  const appUrl = page.url();
  const navigation = page.waitForEvent('framenavigated', { timeout: 1500 }).then(() => 'navigated', () => 'stayed');

  // Act
  await page.evaluate((url) => {
    location.assign(url);
  }, feedServer.articleUrl);

  // Assert
  expect(await navigation).toBe('stayed');
  expect(page.url()).toBe(appUrl);
  expect(feedServer.requestedPaths).not.toContain('/article');
});

windowSecurityTest('web permissions are denied', async ({ launchApp }) => {
  // Arrange
  const { page } = await launchApp();

  // Act
  const permission = await page.evaluate(() => Notification.requestPermission());

  // Assert
  expect(permission).toBe('denied');
});

windowSecurityTest('inline scripts do not run', async ({ launchApp }) => {
  // Arrange
  const { page } = await launchApp();

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

windowSecurityTest('the app renders under its content security policy without a violation', async ({ launchApp }) => {
  // Arrange: the listener has to exist before the document loads, so it is installed for the next navigation.
  const { page } = await launchApp();
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
