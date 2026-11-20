// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Page } from '@playwright/test';
import { expect, subscribe, test } from './fixtures';

// The river's scroll container is the only `.flex-1.overflow-y-auto` element on the home route;
// the feed sidebar next to it also scrolls, but is `w-64 flex-none` instead.
const riverScrollContainer = (page: Page) => page.locator('.flex-1.overflow-y-auto');

test('keeps the river scroll position after returning from the reader', async ({ feedServer, launchApp }) => {
  // Arrange: fetchFeed caps a single refresh at 30 items, so that is the largest river this test can fill.
  const articles = Array.from({ length: 30 }, (_, index) => ({
    title: `Article number ${index}`,
    link: `http://127.0.0.1/article-${index}`,
  }));
  feedServer.publish(articles);
  const page = await launchApp();
  await subscribe(page, feedServer.url);
  // Every article shares the same pubDate, so the river's id-DESC tiebreak sorts the highest-id
  // (last-inserted) article first: "Article number 29" leads, "Article number 0" trails.
  await expect(page.getByText('Article number 29', { exact: true })).toBeVisible();
  await expect(page.getByText('Article number 0', { exact: true })).toBeAttached();

  // Act: Playwright's `.click()` scrolls its target into view first, which would itself move
  // the river before navigation. Dispatch DOM clicks instead, so the scroll position set below
  // is exactly what's still in place when the reader opens.
  //
  // Setting `scrollTop` fires a native `scroll` event asynchronously (on the next frame), but
  // TanStack Router's scroll restoration only remembers elements that already received one by the
  // time navigation starts. Dispatching it inline makes the router's capture-phase listener see it
  // synchronously, instead of racing frame timing before the click below.
  await riverScrollContainer(page).evaluate((element) => {
    element.scrollTop = 800;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(() => riverScrollContainer(page).evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  const scrollTopBeforeLeaving = await riverScrollContainer(page).evaluate((element) => element.scrollTop);

  await page.getByText('Article number 15', { exact: true }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByRole('heading', { name: 'Article number 15' })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByText('Article number 29', { exact: true })).toBeAttached();

  // Assert
  await expect.poll(() => riverScrollContainer(page).evaluate((element) => element.scrollTop)).toBe(scrollTopBeforeLeaving);
});

test('keeps the Magazine river scroll position after returning from the reader', async ({ feedServer, launchApp }) => {
  // Arrange
  const articles = Array.from({ length: 30 }, (_, index) => ({
    title: `Article number ${index}`,
    link: `http://127.0.0.1/article-${index}`,
  }));
  feedServer.publish(articles);
  const page = await launchApp();
  await page.evaluate(() => localStorage.setItem('preferences-density', JSON.stringify('Magazine')));
  await page.reload();
  await subscribe(page, feedServer.url);
  await expect(page.getByText('Article number 0', { exact: true })).toBeAttached();
  // The Magazine rows get their height from a ResizeObserver after the cards render, so the river can still be too short to scroll.
  await expect.poll(() => riverScrollContainer(page).evaluate((element) => element.scrollHeight - element.clientHeight)).toBeGreaterThan(1500);
  await riverScrollContainer(page).evaluate((element) => {
    element.scrollTop = 1500;
    element.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(() => riverScrollContainer(page).evaluate((element) => element.scrollTop)).toBeGreaterThan(1000);
  const scrollTopBeforeLeaving = await riverScrollContainer(page).evaluate((element) => element.scrollTop);

  // Act
  await page.getByText('Article number 15', { exact: true }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByRole('heading', { name: 'Article number 15' })).toBeVisible();
  await page.getByRole('button', { name: 'Home', exact: true }).evaluate((element) => (element as HTMLElement).click());
  await expect(page.getByText('Article number 29', { exact: true })).toBeAttached();

  // Assert
  await expect.poll(() => riverScrollContainer(page).evaluate((element) => element.scrollTop)).toBe(scrollTopBeforeLeaving);
});
