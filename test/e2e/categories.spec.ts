// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Locator, Page } from '@playwright/test';
import { HOME_WORKSPACE_ID, type FeedCategory } from '../../src/shared/contracts';
import { expect, subscribeAndReload, test } from './fixtures';

async function categoryIdFor(page: Page, name: string): Promise<number> {
  const categories = await page.evaluate((workspaceId) => window.electron.ipcRenderer.invoke('feeds:list-categories', { workspaceId }), HOME_WORKSPACE_ID) as FeedCategory[];
  const category = categories.find((candidate) => candidate.name === name);
  if (!category) {
    throw new Error(`expected a category named ${name}`);
  }
  return category.id;
}

// The folder's open state is saved to localStorage, so a relaunch can start with it already expanded.
async function ensureFolderOpen(page: Page, folderName: string, feedNamePattern: RegExp): Promise<void> {
  if (!(await page.getByRole('button', { name: feedNamePattern }).isVisible())) {
    await page.getByRole('button', { name: folderName, exact: true }).click();
  }
}

// A real, stepped mouse gesture: react-aria's drag-and-drop is pointer-driven rather than native
// HTML5 DnD, so this is closer to what actually triggers it than a single click or `dragAndDrop`.
async function dragOnto(page: Page, source: Locator, target: Locator): Promise<void> {
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) {
    throw new Error('expected both the drag source and the drop target to have a layout box');
  }
  await page.mouse.move(sourceBox.x + sourceBox.width / 2, sourceBox.y + sourceBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(targetBox.x + targetBox.width / 2, targetBox.y + targetBox.height / 2, { steps: 10 });
  await page.mouse.up();
}

test('renaming a folder via the context menu persists the new name', async ({ launchElectron }) => {
  // Arrange
  const { app, page } = await launchElectron();
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
  const categoryId = await categoryIdFor(page, 'Tech');

  // Act: stand in for the native menu's click, which Playwright cannot drive.
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('feeds:rename-category-requested', id);
  }, categoryId);
  const input = page.getByRole('textbox', { name: 'Rename Tech' });
  await expect(input).toHaveValue('Tech');
  await input.fill('Engineering');
  await input.press('Enter');

  // Assert
  await expect(page.getByRole('button', { name: 'Engineering', exact: true })).toBeVisible();

  // Act: relaunch against the same user data dir.
  const relaunched = await launchElectron();

  // Assert: the rename persisted.
  await expect(relaunched.page.getByRole('button', { name: 'Engineering', exact: true })).toBeVisible();
});

test('typing a letter that matches the folder\'s own name does not close the rename field', async ({ launchElectron }) => {
  // Arrange: GridList's keyboard typeahead used to intercept a keystroke matching another row's
  // leading letters (here, the field's own folder) before it reached the input.
  const { app, page } = await launchElectron();
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
  const categoryId = await categoryIdFor(page, 'Tech');
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('feeds:rename-category-requested', id);
  }, categoryId);
  const input = page.getByRole('textbox', { name: 'Rename Tech' });
  await expect(input).toHaveValue('Tech');

  // Act: real, per-key events — `.fill()` bypasses keydown and would not exercise this bug.
  await input.pressSequentially('t');

  // Assert
  await expect(input).toHaveValue('Techt');
});

test('creating a folder via "New folder" persists and stays visible with no feeds in it', async ({ launchElectron }) => {
  // Arrange
  const { page } = await launchElectron();

  // Act
  await page.getByRole('button', { name: 'New folder' }).click();
  const input = page.getByRole('textbox', { name: 'New folder name' });
  await input.fill('Recipes');
  await input.press('Enter');

  // Assert
  await expect(page.getByRole('button', { name: 'Recipes', exact: true })).toBeVisible();

  // Act: relaunch against the same user data dir.
  const relaunched = await launchElectron();

  // Assert: the folder persisted, still with no feeds in it.
  await expect(relaunched.page.getByRole('button', { name: 'Recipes', exact: true })).toBeVisible();
  await subscribeAndReload(relaunched.page, 'http://127.0.0.1/feed-a', 'Feed A', 'Recipes');
  await relaunched.page.getByRole('button', { name: 'Recipes', exact: true }).click();
  await expect(relaunched.page.getByRole('button', { name: /^Feed A/ })).toBeVisible();
});

test('a newly created folder is a valid drag-and-drop target', async ({ launchElectron }) => {
  // Arrange
  const { page } = await launchElectron();
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'New folder' }).click();
  const input = page.getByRole('textbox', { name: 'New folder name' });
  await input.fill('Recipes');
  await input.press('Enter');
  await expect(page.getByRole('button', { name: 'Recipes', exact: true })).toBeVisible();
  await ensureFolderOpen(page, 'Tech', /^Feed A/);

  // Act
  await dragOnto(page, page.getByRole('button', { name: 'Drag to a folder' }), page.getByRole('button', { name: 'Recipes', exact: true }));

  // Assert: Feed A leaves the still-open Tech folder first. `ensureFolderOpen` reads whether the
  // feed is already on screen, so calling it any sooner reads the pre-move Tech row and skips the
  // click that expands Recipes.
  await expect(page.getByRole('button', { name: /^Feed A/ })).not.toBeVisible();

  await ensureFolderOpen(page, 'Recipes', /^Feed A/);
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();
});

test('dragging a feed onto another folder moves it there', async ({ launchElectron }) => {
  // Arrange
  const { page } = await launchElectron();
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await subscribeAndReload(page, 'http://127.0.0.1/feed-b', 'Feed B', 'News');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'News', exact: true })).toBeVisible();
  await ensureFolderOpen(page, 'Tech', /^Feed A/);

  // Act
  await dragOnto(page, page.getByRole('button', { name: 'Drag to a folder' }), page.getByRole('button', { name: 'News', exact: true }));

  // Assert: Feed A no longer shows under the still-open Tech folder...
  await expect(page.getByRole('button', { name: /^Feed A/ })).not.toBeVisible();

  // ...and now lives under News.
  await ensureFolderOpen(page, 'News', /^Feed A/);
  await expect(page.getByRole('button', { name: /^Feed A/ })).toBeVisible();
});

test('dragging a feed onto a feed row moves it into that row\'s folder', async ({ launchElectron }) => {
  // Arrange: both folders open, so the drop lands on a feed row rather than a folder header.
  const { page } = await launchElectron();
  await subscribeAndReload(page, 'http://127.0.0.1/feed-a', 'Feed A', 'Tech');
  await subscribeAndReload(page, 'http://127.0.0.1/feed-b', 'Feed B', 'News');
  await expect(page.getByRole('button', { name: 'Tech', exact: true })).toBeVisible();
  await ensureFolderOpen(page, 'Tech', /^Feed A/);
  await ensureFolderOpen(page, 'News', /^Feed B/);

  // Act
  const feedARow = page.getByRole('row').filter({ has: page.getByRole('button', { name: /^Feed A/ }) });
  await dragOnto(page, feedARow.getByRole('button', { name: 'Drag to a folder' }), page.getByRole('button', { name: /^Feed B/ }));

  // Assert: both feeds now sit under News, and Tech still shows with nothing under it. Both folders
  // stay expanded, so the feeds never leave the screen — row order is the only thing that says which
  // folder holds them.
  await expect(page.getByRole('grid', { name: 'Feeds' }).getByRole('row')).toHaveText([/^Tech$/, /^News$/, /Feed A/, /Feed B/]);
});
