// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, subscribe, test } from './fixtures';

test('search filters river items by title and clears with Escape', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([
    { title: 'Rust async runtime', link: 'http://127.0.0.1/rust', description: 'A deep dive into executors' },
    { title: 'TypeScript generics', link: 'http://127.0.0.1/ts', description: 'Compiler internals explained' },
    { title: 'Cooking pasta', link: 'http://127.0.0.1/pasta', description: 'Salt the water well' },
  ]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  const search = page.getByRole('textbox', { name: 'Search' });

  // Act
  await search.fill('pasta');

  // Assert
  await expect(page.getByText('Cooking pasta', { exact: true })).toBeVisible();
  await expect(page.getByText('Rust async runtime', { exact: true })).not.toBeVisible();
  await expect(page.getByText('TypeScript generics', { exact: true })).not.toBeVisible();

  // Act: Escape restores every item.
  await search.press('Escape');

  // Assert
  await expect(page.getByText('Cooking pasta', { exact: true })).toBeVisible();
  await expect(page.getByText('Rust async runtime', { exact: true })).toBeVisible();
  await expect(page.getByText('TypeScript generics', { exact: true })).toBeVisible();
});

test('search matches the feed name and surfaces its items', async ({ feedServer, launchApp }) => {
  // Arrange: "local" appears in no article title or description, only in the feed title.
  feedServer.publish([
    { title: 'Rust async runtime', link: 'http://127.0.0.1/rust', description: 'A deep dive into executors' },
    { title: 'TypeScript generics', link: 'http://127.0.0.1/ts', description: 'Compiler internals explained' },
  ]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  const search = page.getByRole('textbox', { name: 'Search' });

  // Act
  await search.fill('local');

  // Assert
  await expect(page.getByText('Rust async runtime', { exact: true })).toBeVisible();
  await expect(page.getByText('TypeScript generics', { exact: true })).toBeVisible();
});

test('search over the description shows a no-results message when nothing matches', async ({ feedServer, launchApp }) => {
  // Arrange
  feedServer.publish([
    { title: 'Rust async runtime', link: 'http://127.0.0.1/rust', description: 'A deep dive into executors' },
  ]);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  const search = page.getByRole('textbox', { name: 'Search' });

  // Act
  await search.fill('executors kubernetes');

  // Assert: scoped to the <p>, since the same copy is also mirrored into the
  // visually-hidden aria-live region for screen readers.
  await expect(page.getByText('No results for "executors kubernetes"', { exact: true }).and(page.locator('p'))).toBeVisible();
  await expect(page.getByText('Rust async runtime', { exact: true })).not.toBeVisible();
});
