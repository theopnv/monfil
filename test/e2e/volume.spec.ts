import { test, expect, _electron as electron } from '@playwright/test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { initializeDatabase, closeDatabase } from '../../src/main/db/database';
import { addFeedToDatabase } from '../../src/main/db/crud/insert';
import { DB_FILE_NAME } from '../../src/main/constants';

const FEED_COUNT = 20;
const ITEMS_PER_FEED = 30; // 600 items total, well past RIVER_MAX_PAGES * RIVER_PAGE_SIZE.
const RIVER_PAGE_SIZE = 50;
const RIVER_MAX_PAGES = 8;
const READY_BUDGET_MS = 10_000;

// Seeding through the local RSS server is too slow at this size; write the rows directly. This
// runs under Playwright's own Node process, not Electron, but better-sqlite3 ships prebuilds for
// both ABIs and node-gyp-build picks the right one at require time, so this needs no special setup.
async function seedDatabase(userDataDir: string): Promise<void> {
  await initializeDatabase(path.join(userDataDir, DB_FILE_NAME));
  try {
    for (let feedIndex = 0; feedIndex < FEED_COUNT; feedIndex++) {
      const items = Array.from({ length: ITEMS_PER_FEED }, (_, itemIndex) => {
        // Feed 0's items are the newest, item 0 of each feed newer than item 1, and so on.
        const secondsOld = feedIndex * ITEMS_PER_FEED + itemIndex;
        return {
          title: `Feed ${feedIndex} item ${itemIndex}`,
          link: `https://example.com/feed-${feedIndex}/item-${itemIndex}`,
          guid: `https://example.com/feed-${feedIndex}/item-${itemIndex}`,
          pubDate: new Date(Date.now() - secondsOld * 1000).toUTCString(),
          description: `Description for item ${itemIndex} of feed ${feedIndex}`,
          image: undefined,
          author: undefined,
          extra: undefined,
          read_at: undefined,
        };
      });

      const result = await addFeedToDatabase({
        link: `https://example.com/feed-${feedIndex}`,
        title: `Feed ${feedIndex}`,
        type: 'rss',
        items,
        categoryName: 'volume',
        showInWorkspace: true,
      });
      if (!result.success) {
        throw new Error(`failed to seed feed ${feedIndex}: ${result.error.message}`);
      }
    }
  } finally {
    await closeDatabase();
  }
}

test('the river stays bounded against a large corpus', async () => {
  const userDataDir = await mkdtemp(path.join(tmpdir(), 'monfil-e2e-volume-'));
  try {
    await seedDatabase(userDataDir);

    const startedAt = Date.now();
    const app = await electron.launch({ args: ['.', `--user-data-dir=${userDataDir}`] });
    try {
      const page = await app.firstWindow();
      const cards = page.locator('[data-item-id]');

      // Assert: reaches an interactive river inside a time budget.
      await expect(page.getByText('Feed 0 item 0', { exact: true })).toBeVisible({ timeout: READY_BUDGET_MS });
      expect(Date.now() - startedAt).toBeLessThan(READY_BUDGET_MS);

      // Assert: first paint holds one page, not the corpus.
      await expect.poll(() => cards.count()).toBeLessThanOrEqual(RIVER_PAGE_SIZE);

      // Act: scroll to the bottom repeatedly, giving each page time to load and render.
      const scrollContainer = page.locator('.flex-1.overflow-y-auto');
      for (let i = 0; i < RIVER_MAX_PAGES + 2; i++) {
        await scrollContainer.evaluate((element) => {
          element.scrollTop = element.scrollHeight;
        });
        await page.waitForTimeout(150);
      }

      // Assert: bounded by maxPages even after scrolling past every page the corpus has to offer.
      await expect.poll(() => cards.count()).toBeLessThanOrEqual(RIVER_MAX_PAGES * RIVER_PAGE_SIZE);
      const scrolledCount = await cards.count();

      // Act: hide one feed from the sidebar. A row rotates home -> only -> hidden, so this takes two clicks.
      await page.getByRole('button', { name: 'volume', exact: true }).click();
      const feedRow = page.getByRole('button', { name: /^Feed 0,/ });
      await feedRow.click();
      await expect(feedRow).toHaveAttribute('data-visibility', 'only');
      await feedRow.click();
      await expect(feedRow).toHaveAttribute('data-visibility', 'hidden');

      // Assert: the river rescopes instead of transferring the whole corpus (no spike upward).
      await expect(page.getByText('Feed 0 item 0', { exact: true })).not.toBeVisible();
      await expect.poll(() => cards.count()).toBeLessThanOrEqual(scrolledCount);
    } finally {
      await app.close();
    }
  } finally {
    await rm(userDataDir, { recursive: true });
  }
});
