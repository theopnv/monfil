// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Page } from '@playwright/test';
import { expect, subscribe, test } from './fixtures';

// The folder's open state is saved to localStorage, so a relaunch against the same user data
// dir can start with it already expanded.
async function ensureFolderOpen(page: Page): Promise<void> {
  await expect(page.getByRole('button', { name: 'tech', exact: true })).toBeVisible();
  const row = page.getByRole('button', { name: /^Local feed/ });
  if (!(await row.isVisible())) {
    await page.getByRole('button', { name: 'tech', exact: true }).click();
  }
  await expect(row).toBeVisible();
}

test('hiding a feed with its eye removes it from home and survives a relaunch', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
  await ensureFolderOpen(page);
  const row = page.getByRole('button', { name: /^Local feed/ });

  // Act: a click on the row only focuses the feed, so the eye is the one way to hide it.
  await row.click();
  await expect(row).toHaveAttribute('data-visibility', 'only');
  await page.getByRole('button', { name: 'Hide Local feed' }).click();

  // Assert
  await expect(row).toHaveAttribute('data-visibility', 'hidden');
  await expect(page.getByText('First article', { exact: true })).not.toBeVisible();
  await expect(page.getByText('1 hidden feed', { exact: true })).toBeVisible();

  // Act: relaunch against the same user data dir.
  const relaunched = await launchApp();

  // Assert: the hide persisted, but the row is not stuck in a session-only "only" state.
  await expect(relaunched.getByText('First article', { exact: true })).not.toBeVisible();
  await ensureFolderOpen(relaunched);
  await expect(relaunched.getByRole('button', { name: /^Local feed/ })).toHaveAttribute('data-visibility', 'hidden');
});

test('clicking a feed row focuses it and the strip clears the focus, which does not survive a relaunch', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await ensureFolderOpen(page);
  const row = page.getByRole('button', { name: /^Local feed/ });

  // Act
  await row.click();

  // Assert: a second click on the row never hides the feed, it only unfocuses it.
  await expect(row).toHaveAttribute('data-visibility', 'only');
  await expect(page.getByText('Showing 1 of 1 feed', { exact: true })).toBeVisible();
  await row.click();
  await expect(row).toHaveAttribute('data-visibility', 'home');
  await expect(page.getByText('Showing 1 of 1 feed', { exact: true })).not.toBeVisible();

  // Act: focus again, then clear it with the strip.
  await row.click();
  await page.getByRole('button', { name: 'Show all feeds' }).click();

  // Assert
  await expect(row).toHaveAttribute('data-visibility', 'home');

  // Act: focus once more and relaunch.
  await row.click();
  const relaunched = await launchApp();

  // Assert
  await ensureFolderOpen(relaunched);
  await expect(relaunched.getByRole('button', { name: /^Local feed/ })).toHaveAttribute('data-visibility', 'home');
});

test('the strip shows hidden feeds again', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([{ title: 'First article', link: 'http://127.0.0.1/first' }]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  await ensureFolderOpen(page);
  await page.getByRole('button', { name: /^Local feed/ }).hover();
  await page.getByRole('button', { name: 'Hide Local feed' }).click();
  await expect(page.getByText('1 hidden feed', { exact: true })).toBeVisible();

  // Act
  await page.getByRole('button', { name: 'Show hidden feeds' }).click();

  // Assert
  await expect(page.getByRole('button', { name: /^Local feed/ })).toHaveAttribute('data-visibility', 'home');
  await expect(page.getByText('1 hidden feed', { exact: true })).not.toBeVisible();
  await expect(page.getByText('First article', { exact: true })).toBeVisible();
});
