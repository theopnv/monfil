// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, subscribe, test } from './fixtures';

test('an opened article is still read after a restart', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const firstRun = await launchApp();
  await subscribe(firstRun, feedServer.url);
  await expect(firstRun.getByText('First article', { exact: true })).toBeVisible();

  // Act
  await firstRun.getByText('First article', { exact: true }).click();
  await expect(firstRun.getByRole('heading', { name: 'First article' })).toBeVisible();

  // The read mark is written asynchronously behind the optimistic UI update, so wait for the
  // database to confirm it before restarting.
  await expect
    .poll(() => firstRun.evaluate(() => window.electron.ipcRenderer.invoke('items:query', { workspaceId: 1, limit: 100 })
      .then((page) => 'rows' in page && page.rows.some((row) => row.title === 'First article' && Boolean(row.readAt)))))
    .toBe(true);

  const secondRun = await launchApp();

  // Assert
  const page = await secondRun.evaluate(() => window.electron.ipcRenderer.invoke('items:query', { workspaceId: 1, limit: 100 }));
  if (!('rows' in page)) {
    throw new Error(page.error.message);
  }
  const item = page.rows.find((candidate) => candidate.title === 'First article');
  expect(item?.readAt).toBeTruthy();
});
