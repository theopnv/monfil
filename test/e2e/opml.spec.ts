// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { parseOpmlDocument } from '../../src/main/opml/parse';
import { expect, rss, serve, test as base } from './fixtures';

const feed = (title: string) => rss([{ title: 'Article', link: 'http://127.0.0.1/article' }], title);

const test = base.extend<{ workDir: string }>({
  workDir: async ({}, use) => {
    const workDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-opml-'));
    try {
      await use(workDir);
    } finally {
      await rm(workDir, { recursive: true });
    }
  },
});

test('imports an OPML file as a new workspace, then exports it back out with the same categories and feeds', async ({ launchElectron, workDir }) => {
  // Arrange: two local feeds under one category, referenced by an OPML file on disk.
  const server = await serve((request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    response.end(feed(request.url === '/a.xml' ? 'Feed A' : 'Feed B'));
  });
  const feedAUrl = `${server.origin}/a.xml`;
  const feedBUrl = `${server.origin}/b.xml`;

  const importPath = path.join(workDir, 'import.opml');
  await writeFile(importPath, `<?xml version="1.0" encoding="UTF-8"?><opml version="1.0"><head><title>Watch pack</title></head><body>`
    + `<outline text="Tech">`
    + `<outline type="rss" text="Feed A" xmlUrl="${feedAUrl}"/>`
    + `<outline type="rss" text="Feed B" xmlUrl="${feedBUrl}"/>`
    + `</outline></body></opml>`, 'utf-8');

  try {
    const { app, page } = await launchElectron();
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = (() => Promise.resolve({ canceled: false, filePaths: [filePath] })) as typeof dialog.showOpenDialog;
    }, importPath);

    // Act: import through the Settings UI, as a new workspace.
    await page.getByRole('link', { name: 'Settings' }).click();
    await page.getByRole('button', { name: 'Import OPML' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    // Assert: the import summary reports both feeds, and the new tab lists them under Tech.
    await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
    await expect(page.getByText('Imported 2 feeds.', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await expect(page.getByRole('link', { name: 'CI/CD watch' })).toBeVisible();

    // Act: export the new workspace back out.
    const exportPath = path.join(workDir, 'export.opml');
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showSaveDialog = (() => Promise.resolve({ canceled: false, filePath })) as typeof dialog.showSaveDialog;
    }, exportPath);
    const workspaces = await page.evaluate(() => window.electron.ipcRenderer.invoke('workspaces:list', undefined));
    if (!Array.isArray(workspaces)) {
      throw new Error(workspaces.error.message);
    }
    const workspace = workspaces.find((candidate) => candidate.name === 'CI/CD watch');
    if (!workspace) {
      throw new Error('expected the imported workspace to exist');
    }
    const exportResult = await page.evaluate((workspaceId) => window.electron.ipcRenderer.invoke('opml:export', { workspaceId }), workspace.id);
    expect(exportResult.success).toBe(true);

    // Assert: the exported file round-trips to the same category and feeds.
    const exportedXml = await readFile(exportPath, 'utf-8');
    const parsed = parseOpmlDocument(exportedXml);
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.categories).toHaveLength(1);
    expect(parsed.data.categories[0]?.name).toBe('Tech');
    expect(parsed.data.categories[0]?.feeds.map((feed) => feed.xmlUrl).sort()).toEqual([feedAUrl, feedBUrl].sort());
  } finally {
    await server.close();
  }
});

test('importing OPML from an empty workspace\'s own button fills that workspace, not a new one', async ({ launchElectron, workDir }) => {
  // Arrange: one local feed, referenced by an OPML file on disk.
  const server = await serve((_request, response) => {
    response.writeHead(200, { 'Content-Type': 'application/rss+xml' });
    response.end(feed('Feed A'));
  });
  const feedUrl = `${server.origin}/a.xml`;

  const importPath = path.join(workDir, 'import.opml');
  await writeFile(importPath, `<?xml version="1.0" encoding="UTF-8"?><opml version="1.0"><head><title>Watch pack</title></head><body>`
    + `<outline text="Tech"><outline type="rss" text="Feed A" xmlUrl="${feedUrl}"/></outline></body></opml>`, 'utf-8');

  try {
    const { app, page } = await launchElectron();
    await app.evaluate(({ dialog }, filePath) => {
      dialog.showOpenDialog = (() => Promise.resolve({ canceled: false, filePaths: [filePath] })) as typeof dialog.showOpenDialog;
    }, importPath);

    // Act: create an empty workspace, then import through its own empty-state button.
    await page.getByRole('button', { name: 'New workspace' }).click();
    await page.getByRole('textbox', { name: 'Name' }).fill('CI/CD watch');
    await page.getByRole('button', { name: 'Create workspace' }).click();
    await expect(page.getByRole('heading', { name: 'Nothing here yet' })).toBeVisible();

    await page.getByRole('button', { name: 'Import OPML' }).click();
    await expect(page.getByRole('heading', { name: 'Import OPML into CI/CD watch' })).toBeVisible();
    await expect(page.getByRole('radio', { name: 'New workspace' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Import', exact: true }).click();

    // Assert: the feed lands in the workspace the user was already on.
    await expect(page.getByRole('heading', { name: 'Import complete' })).toBeVisible();
    await page.getByRole('button', { name: 'Done' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();

    // Assert: Home never saw it.
    await page.getByRole('link', { name: 'Home' }).click();
    await expect(page.getByRole('button', { name: /^Feed A/ })).not.toBeVisible();
  } finally {
    await server.close();
  }
});
