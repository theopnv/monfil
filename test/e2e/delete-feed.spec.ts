// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, feedIdFor, subscribe, test } from './fixtures';

test('confirming the dialog removes the feed and its items, even after a restart', async ({ feedServer, launchElectron }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const { app, page } = await launchElectron();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
  const feedId = await feedIdFor(page, feedServer.url);

  // Act: stand in for the native menu's click, which Playwright cannot drive.
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('menu:action', { kind: 'feed', action: 'delete', id });
  }, feedId);
  await expect(page.getByRole('heading', { name: 'Delete feed' })).toBeVisible();
  await page.getByRole('button', { name: 'Delete feed' }).click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Delete feed' })).not.toBeVisible();
  await expect(page.getByText('First article', { exact: true })).not.toBeVisible();

  // Act: relaunch against the same user data dir.
  const relaunched = await launchElectron();

  // Assert
  await expect(relaunched.page.getByText('First article', { exact: true })).not.toBeVisible();
});

test('cancelling the dialog leaves the feed in place', async ({ feedServer, launchElectron }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const { app, page } = await launchElectron();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
  const feedId = await feedIdFor(page, feedServer.url);

  // Act
  await app.evaluate(({ BrowserWindow }, id) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('menu:action', { kind: 'feed', action: 'delete', id });
  }, feedId);
  await expect(page.getByRole('heading', { name: 'Delete feed' })).toBeVisible();
  await page.getByRole('button', { name: 'Cancel' }).click();

  // Assert
  await expect(page.getByRole('heading', { name: 'Delete feed' })).not.toBeVisible();
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
});
