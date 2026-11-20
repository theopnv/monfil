// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { HOME_WORKSPACE_ID } from '../../src/shared/contracts';
import { expect, test } from './fixtures';

test('Saved keeps read and unread articles through restart and source removal', async ({ launchApp }) => {
  // Arrange
  const setup = await launchApp();
  const feedId = await setup.evaluate(async (workspaceId) => {
    await window.electron.ipcRenderer.invoke('settings:set', { key: 'refreshOnLaunch', value: false });
    const result = await window.electron.ipcRenderer.invoke('feeds:submit-add-feed', {
      workspaceId, link: 'https://saved.example/feed', title: 'Saved source', type: 'rss',
      categoryName: 'Tech', showInWorkspace: true,
      items: ['Unread reference', 'Read reference'].map((title, index) => ({
        title, guid: title, link: undefined, pubDate: new Date().toISOString(),
        description: '<p>Reference content kept in the database.</p>', image: undefined,
        author: undefined, extra: undefined, read_at: index === 1 ? new Date().toISOString() : undefined,
      })),
    });
    if (!result.success) {
      throw new Error(result.error.message);
    }
    return result.data.id;
  }, HOME_WORKSPACE_ID);
  let page = await launchApp();
  await page.getByRole('radio', { name: 'All', exact: true }).click();
  await expect(page.getByText('Read reference', { exact: true })).toBeVisible();

  // Act
  for (const title of ['Unread reference', 'Read reference']) {
    await page.getByRole('button', { name: new RegExp(`^${title},`) }).locator('..')
      .getByRole('button', { name: 'Save', exact: true }).click();
  }
  await page.getByRole('link', { name: 'Saved', exact: true }).click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible();
  await expect(page.getByText('Unread reference', { exact: true })).toBeVisible();
  await expect(page.getByText('Read reference', { exact: true })).toBeVisible();
  const saved = await page.evaluate((workspaceId) => window.electron.ipcRenderer.invoke('saved:query', { workspaceId, limit: 50 }), HOME_WORKSPACE_ID);
  expect('rows' in saved && saved.rows.filter((row) => !!row.readAt)).toHaveLength(1);

  // Act
  const removed = await page.evaluate(({ feedId, workspaceId }) => window.electron.ipcRenderer.invoke('feeds:delete-feed', { feedId, workspaceId }), { feedId, workspaceId: HOME_WORKSPACE_ID });
  expect(removed.success).toBe(true);
  page = await launchApp();
  await page.getByRole('link', { name: 'Saved', exact: true }).click();
  await page.getByText('Unread reference', { exact: true }).click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Unread reference', exact: true })).toBeVisible();
  await expect(page.getByTestId('article-body').getByText('Reference content kept in the database.', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Saved', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Saved', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Remove from Saved' }).first().click();
  await expect(page.getByRole('button', { name: 'Remove from Saved' })).toHaveCount(1);
});
