// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { dialog } from 'electron';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';
import { db, initializeDatabase } from '../db/database';
import { exportWorkspaceOpml } from './export';
import { parseOpmlDocument } from './parse';

vi.mock(import('electron'), () => ({ dialog: { showSaveDialog: vi.fn() } as unknown as Electron.Dialog }));

let exportDirectory: string;

async function addWorkspace(name: string): Promise<number> {
  const workspace = await db.insertInto('workspace').values({ name, icon: 'Code01', color: '#3b82f6', position: 1 }).returningAll().executeTakeFirstOrThrow();
  return workspace.id;
}

async function addFeed(workspaceId: number, categoryName: string, title: string, link: string): Promise<void> {
  const category = await db.insertInto('feedCategory')
    .values({ name: categoryName, workspace_id: workspaceId })
    .onConflict((oc) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
    .returningAll()
    .executeTakeFirstOrThrow();
  const feed = await db.insertInto('feedMetadata').values({ link, title }).returningAll().executeTakeFirstOrThrow();
  await db.insertInto('feedPlacement').values({ feed_id: feed.id, category_id: category.id, workspace_id: workspaceId, showInWorkspace: 1 }).execute();
}

function saveTo(filePath: string): void {
  vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: false, filePath });
}

beforeAll(async () => {
  await initializeDatabase(':memory:');
  exportDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'monfil-export-'));
});

beforeEach(() => {
  vi.mocked(dialog.showSaveDialog).mockReset();
});

afterEach(async () => {
  await db.deleteFrom('feedPlacement').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
});

afterAll(async () => {
  await fs.rm(exportDirectory, { recursive: true, force: true });
});

describe('exportWorkspaceOpml', () => {
  test('fails without asking where to save when the workspace does not exist', async () => {
    // Act
    const result = await exportWorkspaceOpml(9999);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'WORKSPACE_NOT_FOUND', message: expect.any(String) } });
    expect(dialog.showSaveDialog).not.toHaveBeenCalled();
  });

  test('writes the feeds of the workspace, grouped by category, so that parsing the file returns them', async () => {
    // Arrange
    const workspaceId = await addWorkspace('CI/CD watch');
    await addFeed(workspaceId, 'Tech', 'Ars Technica', 'https://feeds.arstechnica.com/arstechnica/index');
    await addFeed(workspaceId, 'Testing', 'Testing Blog', 'https://testing.example/feed');
    await addFeed(workspaceId, 'Tech', 'Hacker News', 'https://hnrss.org/newest?points=300');
    await addFeed(HOME_WORKSPACE_ID, 'Elsewhere', 'Other workspace', 'https://elsewhere.example/feed');
    const filePath = path.join(exportDirectory, 'grouped.opml');
    saveTo(filePath);

    // Act
    const result = await exportWorkspaceOpml(workspaceId);

    // Assert
    expect(result).toEqual({ success: true, data: undefined });
    const parsed = parseOpmlDocument(await fs.readFile(filePath, 'utf-8'));
    expect(parsed.success).toBe(true);
    if (!parsed.success) {
      return;
    }
    expect(parsed.data.title).toBe('CI/CD watch');
    const byName = Object.fromEntries(parsed.data.categories.map((category) => [category.name, category.feeds.map((feed) => feed.title).toSorted()]));
    expect(byName).toEqual({ Tech: ['Ars Technica', 'Hacker News'], Testing: ['Testing Blog'] });
    const hackerNews = parsed.data.categories.flatMap((category) => category.feeds).find((feed) => feed.title === 'Hacker News');
    expect(hackerNews?.xmlUrl).toBe('https://hnrss.org/newest?points=300');
  });

  test('keeps titles and URLs that XML must escape intact through the file', async () => {
    // Arrange
    const workspaceId = await addWorkspace('R&D <lab>');
    await addFeed(workspaceId, 'Q&A "tips"', 'Tom & <Jerry> "news"', 'https://example.com/feed?a=1&b=2&c=<x>');
    const filePath = path.join(exportDirectory, 'escaped.opml');
    saveTo(filePath);

    // Act
    const result = await exportWorkspaceOpml(workspaceId);

    // Assert
    expect(result.success).toBe(true);
    const parsed = parseOpmlDocument(await fs.readFile(filePath, 'utf-8'));
    expect(parsed).toEqual({
      success: true,
      data: {
        title: 'R&D <lab>',
        categories: [{ name: 'Q&A "tips"', feeds: [{ title: 'Tom & <Jerry> "news"', xmlUrl: 'https://example.com/feed?a=1&b=2&c=<x>', type: 'rss' }] }],
      },
    });
  });

  test('suggests the workspace name as the file name and offers only OPML files', async () => {
    // Arrange
    const workspaceId = await addWorkspace('Releases');
    await addFeed(workspaceId, 'Tech', 'Blog', 'https://blog.example/feed');
    saveTo(path.join(exportDirectory, 'suggest.opml'));

    // Act
    await exportWorkspaceOpml(workspaceId);

    // Assert
    expect(dialog.showSaveDialog).toHaveBeenCalledWith({
      defaultPath: 'Releases.opml',
      filters: [{ name: 'OPML', extensions: ['opml'] }],
    });
  });

  test.each([
    ['the dialog is cancelled', { canceled: true, filePath: path.join('unused', 'cancelled.opml') }],
    ['the dialog returns no path', { canceled: false, filePath: '' }],
  ])('returns CANCELLED and writes no file when %s', async (_label, answer) => {
    // Arrange
    const workspaceId = await addWorkspace('Releases');
    await addFeed(workspaceId, 'Tech', 'Blog', 'https://blog.example/feed');
    vi.mocked(dialog.showSaveDialog).mockResolvedValue(answer);
    const writeFile = vi.spyOn(fs, 'writeFile');

    // Act
    const result = await exportWorkspaceOpml(workspaceId);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'CANCELLED', message: expect.any(String) } });
    expect(writeFile).not.toHaveBeenCalled();
    writeFile.mockRestore();
  });

  test('returns FS_ERROR with the system message when the file cannot be written', async () => {
    // Arrange
    const workspaceId = await addWorkspace('Releases');
    await addFeed(workspaceId, 'Tech', 'Blog', 'https://blog.example/feed');
    saveTo(path.join(exportDirectory, 'missing-directory', 'out.opml'));

    // Act
    const result = await exportWorkspaceOpml(workspaceId);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'FS_ERROR', message: expect.stringContaining('ENOENT') } });
  });
});
