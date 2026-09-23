import { test as base, expect, _electron as electron, type ElectronApplication, type Page } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import { HOME_WORKSPACE_ID, type FeedSummary, type WorkspaceSummary } from '../../src/shared/contracts';

const FIXTURE_PUB_DATE = new Date().toUTCString();

function rss(): string {
  return '<?xml version="1.0"?><rss version="2.0"><channel><title>Imported feed</title><description>A local feed</description>'
    + `<item><title>Article</title><link>http://127.0.0.1/article</link><pubDate>${FIXTURE_PUB_DATE}</pubDate><description>An article</description></item>`
    + '</channel></rss>';
}

type WorkspacesTestFixtures = {
  userDataDir: string;
  launchApp: () => Promise<{ app: ElectronApplication; page: Page }>;
};

const workspacesTest = base.extend<WorkspacesTestFixtures>({
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

// Subscribes without going through the wizard, then reloads: only the add-feed wizard invalidates
// the feed query, and this writes behind its back.
async function subscribe(page: Page, link: string, title: string, categoryName: string, workspaceId: number = HOME_WORKSPACE_ID): Promise<void> {
  await page.evaluate(({ link, title, categoryName, workspaceId }) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
    link, title, type: 'rss', items: [], categoryName, workspaceId, showInWorkspace: true,
  }), { link, title, categoryName, workspaceId });
  await page.reload();
}

async function feedIdFor(page: Page, link: string): Promise<number> {
  const feeds = await page.evaluate((workspaceId) => window.electron.ipcRenderer.invoke('feeds:list', { workspaceId }), HOME_WORKSPACE_ID) as FeedSummary[];
  const feed = feeds.find((candidate) => candidate.link === link);
  if (!feed) {
    throw new Error(`expected a feed for ${link}`);
  }
  return feed.id;
}

async function workspaceIdFor(page: Page, name: string): Promise<number> {
  const workspaces = await page.evaluate(() => window.electron.ipcRenderer.invoke('workspaces:list', undefined)) as WorkspaceSummary[];
  const workspace = workspaces.find((candidate) => candidate.name === name);
  if (!workspace) {
    throw new Error(`expected a workspace named ${name}`);
  }
  return workspace.id;
}

async function ensureFolderOpen(page: Page, folderName: string, feedNamePattern: RegExp): Promise<void> {
  if (!(await page.getByRole('button', { name: feedNamePattern }).isVisible())) {
    await page.getByRole('button', { name: folderName, exact: true }).click();
  }
}

workspacesTest('create a workspace, move a feed into it: Home stops listing it and the new tab lists it', async ({ launchApp }) => {
  // Arrange
  const { page } = await launchApp();
  await subscribe(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
  await ensureFolderOpen(page, 'Tech', /^Feed A/);
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();

  // Act: create a workspace through the dialog.
  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
  await page.getByRole('button', { name: 'Create workspace' }).click();

  // Assert: the tab appears in the rail and the app switched to it.
  await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();
  await expect(page.getByText('Nothing here yet', { exact: true })).toBeVisible();

  // Act: move the feed from Home into the new workspace (no drag-and-drop UI for this yet, so the
  // move is driven directly over IPC, same as `subscribe` above).
  const feedId = await feedIdFor(page, 'http://127.0.0.1/feed-a');
  const workspaceId = await workspaceIdFor(page, 'CI/CD watch');
  await page.evaluate(
    ({ feedId, fromWorkspaceId, toWorkspaceId }) => window.electron.ipcRenderer.invoke('feeds:move-to-workspace', { feedId, fromWorkspaceId, toWorkspaceId, categoryName: 'Imported' }),
    { feedId, fromWorkspaceId: HOME_WORKSPACE_ID, toWorkspaceId: workspaceId },
  );
  await page.reload();

  // Assert: the new tab lists the feed.
  await ensureFolderOpen(page, 'Imported', /^Feed A/);
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();

  // Act: switch to Home.
  await page.getByRole('link', { name: 'Home' }).click();

  // Assert: Home no longer lists it.
  await expect(page.getByRole('button', { name: /^Feed A/ })).not.toBeVisible();
});

workspacesTest('a folder opened in one workspace stays open after visiting another workspace', async ({ launchApp }) => {
  // Arrange: a feed in Home, and a workspace with its own feed to switch to and back from.
  const { page } = await launchApp();
  await subscribe(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await ensureFolderOpen(page, 'Tech', /^Feed A/);
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();

  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();

  const workspaceId = await workspaceIdFor(page, 'CI/CD watch');
  await subscribe(page, 'http://127.0.0.1/feed-b', 'Feed B', 'Videos', workspaceId);
  await ensureFolderOpen(page, 'Videos', /^Feed B/);
  await expect(page.getByRole('button', { name: /^Feed B/ })).toBeVisible();

  // Act: switch back to Home.
  await page.getByRole('link', { name: 'Home' }).click();

  // Assert: Tech is still open, not just re-listed but collapsed.
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();
});

workspacesTest('adding a feed through the wizard while on a workspace adds it there, not Home', async ({ launchApp }) => {
  // Arrange: a local feed the wizard can resolve, and a workspace to be on when adding it.
  const server = createServer((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    response.end(rss());
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as AddressInfo;
  const feedUrl = `http://127.0.0.1:${port}/feed.xml`;

  try {
    const { page } = await launchApp();
    await page.getByRole('button', { name: 'New workspace' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();

    // Act: add the feed through the wizard while the app is on that workspace, not Home.
    await page.getByRole('button', { name: 'Add feed', exact: true }).click();
    await page.getByLabel('Feed URL').fill(feedUrl);
    await expect(page.getByText('Feed found', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Continue' }).click();
    await page.getByRole('button', { name: '+ New category' }).click();
    await page.getByLabel('New category name').fill('Imported');
    await page.getByRole('button', { name: 'Add', exact: true }).click();
    await page.getByRole('button', { name: 'Add source' }).click();
    await expect(page.getByText(/is in Imported/)).toBeVisible();
    await page.getByRole('button', { name: 'Go to feed' }).click();
    await page.reload();

    // Assert: the workspace it was added from lists it.
    await ensureFolderOpen(page, 'Imported', /^Imported feed/);
    await expect(page.getByRole('button', { name: /^Imported feed/ })).toBeVisible();

    // Assert: Home does not.
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('button', { name: /^Imported feed/ })).not.toBeVisible();
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});

workspacesTest('creating a folder while on a workspace creates it there, not Home', async ({ launchApp }) => {
  // Arrange: a workspace to be on when creating the folder.
  const { page } = await launchApp();
  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();

  // Act: create a folder through the sidebar while on that workspace, not Home.
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('New folder name').fill('Alerts');
  await page.getByLabel('New folder name').press('Enter');

  // Assert: the workspace it was created from lists it.
  await expect(page.getByRole('button', { name: 'Alerts', exact: true })).toBeVisible();

  // Assert: Home does not.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: 'Alerts', exact: true })).not.toBeVisible();
});

workspacesTest('a folder name another workspace already uses is free to reuse', async ({ launchApp }) => {
  // Arrange: Home already has a Tech folder, and a second workspace to create one from.
  const { page } = await launchApp();
  await subscribe(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();

  // Act: create a folder there under the name Home already holds.
  await page.getByRole('button', { name: 'New folder' }).click();
  await page.getByLabel('New folder name').fill('Tech');
  await page.getByLabel('New folder name').press('Enter');

  // Assert: it is created, with no duplicate-name complaint.
  await expect(page.getByText('A folder with that name already exists.')).not.toBeVisible();
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
});

workspacesTest('renaming a folder while on a workspace leaves the same-named Home folder alone', async ({ launchApp }) => {
  // Arrange: a Tech folder in Home, and a Tech folder in a second workspace.
  const { app, page } = await launchApp();
  await subscribe(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();
  const workspaceId = await workspaceIdFor(page, 'CI/CD watch');
  await subscribe(page, 'http://127.0.0.1/feed-b', 'Feed B', 'Tech', workspaceId);
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();

  // Act: rename it from the workspace it belongs to.
  const categoryId = await page.evaluate(async (id) => {
    const categories = await window.electron.ipcRenderer.invoke('feeds:list-categories', { workspaceId: id });
    return categories.find((category) => category.name === 'Tech')?.id;
  }, workspaceId);
  if (categoryId === undefined) {
    throw new Error('expected a Tech folder in the workspace');
  }
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('feeds:rename-category-requested', id);
  }, categoryId);
  await page.getByRole('textbox', { name: 'Rename Tech' }).fill('Alerts');
  await page.getByRole('textbox', { name: 'Rename Tech' }).press('Enter');

  // Assert: renamed where it was renamed from.
  await expect(page.getByRole('button', { name: 'Alerts', exact: true })).toBeVisible();

  // Assert: Home's Tech folder is untouched.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
});

workspacesTest('deleting a feed from one workspace leaves it in place in another', async ({ launchApp }) => {
  // Arrange: the same feed placed in both Home and a second workspace.
  const { app, page } = await launchApp();
  await subscribe(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await ensureFolderOpen(page, 'Tech', /^Feed A/);
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();

  await page.getByRole('button', { name: 'New workspace' }).click();
  await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();
  const workspaceId = await workspaceIdFor(page, 'CI/CD watch');
  await subscribe(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech', workspaceId);
  await ensureFolderOpen(page, 'Tech', /^Feed A/);
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();
  const feedId = await feedIdFor(page, 'http://127.0.0.1/feed-a');

  // Act: delete it while on the CI/CD watch workspace, standing in for the native menu's click.
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('feeds:delete-feed-requested', id);
  }, feedId);
  await expect(page.getByRole('heading', { name: 'Delete feed' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete feed' }).click();

  // Assert: gone from the workspace it was deleted from.
  await expect(page.getByRole('button', { name: /^Feed A/ })).not.toBeVisible();

  // Assert: still in Home.
  await page.getByRole('link', { name: 'Home' }).click();
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();
});
