// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { HOME_WORKSPACE_ID, type NewFeedInput } from '../../../shared/contracts';
import { db, initializeDatabase } from '../database';
import type { FeedItem } from '../types';
import { addFeedItemsToDatabase, addFeedToDatabase, createCategory, createWorkspace, updateFeedItemImage, upsertArticleContent, syncFeedItemsToDatabase } from './insert';

const feedA: NewFeedInput = { link: 'https://a.example/feed', title: 'Feed A', type: 'rss', items: [], categoryName: 'tech', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true };
const feedB: NewFeedInput = { link: 'https://b.example/feed', title: 'Feed B', type: 'rss', items: [], categoryName: 'tech', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true };

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('articleContent').execute();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedPlacement').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
});

describe('addFeedToDatabase', () => {
  test('inserts the category, metadata and items in one call', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [{ title: 'Item 1', link: `${feedA.link}#1`, guid: `${feedA.link}#1`, pubDate: '2024-01-01', description: 'Item 1 description', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: true,
    });

    if (!result.success) {
      throw new Error(result.error.message);
    }
    expect(result.data.title).toBe(feedA.title);
    expect(result.data.category.name).toBe('tech');
    expect(result.data.showInWorkspace).toBe(1);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.title).toBe('Item 1');
  });

  test('feeds that share a category only create one category row', async () => {
    await addFeedToDatabase(feedA);
    await addFeedToDatabase(feedB);

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();
    const placements = await db.selectFrom('feedPlacement').selectAll().execute();

    expect(categories).toHaveLength(1);
    expect(metadata).toHaveLength(2);
    expect(placements.every((row) => row.category_id === categories[0]?.id)).toBe(true);
  });

  test('items without a link do not conflict with each other', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [
        { title: 'Item 1', link: undefined, guid: 'monfil:hash:one', pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined },
        { title: 'Item 2', link: undefined, guid: 'monfil:hash:two', pubDate: '2024-01-02', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined },
      ],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.items).toHaveLength(2);
  });

  test('resubmitting the same link updates the row instead of duplicating it', async () => {
    await addFeedToDatabase({
      link: feedA.link,
      title: 'Old title',
      items: [],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: true,
    });

    const result = await addFeedToDatabase({
      link: feedA.link,
      title: 'New title',
      items: [],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.title).toBe('New title');
    expect(result.data.showInWorkspace).toBe(0);

    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();
    expect(metadata).toHaveLength(1);
  });

  test('returns only the items of the feed it added', async () => {
    // Arrange
    const anItem = (link: string) => ({ title: link, link, guid: link, pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined });
    await addFeedToDatabase({ ...feedA, items: [anItem('https://a.example/1')] });

    // Act
    const result = await addFeedToDatabase({ ...feedB, items: [anItem('https://b.example/1')] });

    // Assert
    expect(result.success && result.data.items.map((item) => item.guid)).toEqual(['https://b.example/1']);
  });

  test('persists showInWorkspace as 0 when false', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.showInWorkspace).toBe(0);
  });
});

describe('addFeedItemsToDatabase', () => {
  function feedItem(overrides: Partial<Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>> = {}): Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'> {
    const link = 'link' in overrides ? overrides.link : `${feedA.link}#1`;
    // The parser falls back to the link when a feed supplies no guid. Mirror that here.
    return { title: 'Item', link, guid: link ?? 'monfil:test:linkless', pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined, ...overrides };
  }

  async function createFeed(): Promise<number> {
    const result = await addFeedToDatabase(feedA);
    if (!result.success) {
      throw new Error('expected the feed to be created');
    }
    return result.data.id;
  }

  test('returns the rows it inserted, with their assigned ids', async () => {
    // Arrange
    const feedId = await createFeed();

    // Act
    const inserted = await addFeedItemsToDatabase(db, feedId, [
      feedItem({ title: 'Item 1', link: `${feedA.link}#1` }),
      feedItem({ title: 'Item 2', link: `${feedA.link}#2` }),
    ]);

    // Assert
    expect(inserted.success).toBe(true);
    if (!inserted.success) {
      return;
    }
    expect(inserted.data.map((item) => item.title)).toEqual(['Item 1', 'Item 2']);
    expect(inserted.data.every((item) => typeof item.id === 'number')).toBe(true);
    expect(inserted.data.every((item) => item.feed_id === feedId)).toBe(true);
  });

  test('leaves out the rows it skipped as duplicates', async () => {
    // Arrange
    const feedId = await createFeed();
    await addFeedItemsToDatabase(db, feedId, [feedItem({ title: 'Already stored', link: `${feedA.link}#1` })]);

    // Act
    const inserted = await addFeedItemsToDatabase(db, feedId, [
      feedItem({ title: 'Already stored', link: `${feedA.link}#1` }),
      feedItem({ title: 'Brand new', link: `${feedA.link}#2` }),
    ]);

    // Assert
    expect(inserted.success).toBe(true);
    if (!inserted.success) {
      return;
    }
    expect(inserted.data.map((item) => item.title)).toEqual(['Brand new']);
    const stored = await db.selectFrom('feedItem').selectAll().execute();
    expect(stored).toHaveLength(2);
  });

  test('returns an empty array when every item is a duplicate', async () => {
    // Arrange
    const feedId = await createFeed();
    await addFeedItemsToDatabase(db, feedId, [feedItem({ link: `${feedA.link}#1` })]);

    // Act
    const inserted = await addFeedItemsToDatabase(db, feedId, [feedItem({ link: `${feedA.link}#1` })]);

    // Assert
    expect(inserted.success).toBe(true);
    if (!inserted.success) {
      return;
    }
    expect(inserted.data).toEqual([]);
  });

  test('returns an empty array when there is nothing to insert', async () => {
    // Arrange
    const feedId = await createFeed();

    // Act
    const inserted = await addFeedItemsToDatabase(db, feedId, []);

    // Assert
    expect(inserted.success).toBe(true);
    if (!inserted.success) {
      return;
    }
    expect(inserted.data).toEqual([]);
  });

  test('lets two feeds each hold the same link', async () => {
    // Arrange
    const shared = 'https://shared.example/article';
    const feedIdA = await createFeed();
    const resultB = await addFeedToDatabase(feedB);
    if (!resultB.success) {
      throw new Error('expected the second feed to be created');
    }

    // Act
    const intoA = await addFeedItemsToDatabase(db, feedIdA, [feedItem({ title: 'In A', link: shared })]);
    const intoB = await addFeedItemsToDatabase(db, resultB.data.id, [feedItem({ title: 'In B', link: shared })]);

    // Assert
    expect(intoA.success && intoA.data).toHaveLength(1);
    expect(intoB.success && intoB.data).toHaveLength(1);
  });

  test('skips a guid the same feed already holds, whatever the link says', async () => {
    // Arrange
    const feedId = await createFeed();
    await addFeedItemsToDatabase(db, feedId, [feedItem({ title: 'First', guid: 'tag:example,2024:1', link: 'https://a.example/old' })]);

    // Act
    const inserted = await addFeedItemsToDatabase(db, feedId, [feedItem({ title: 'Same item, new url', guid: 'tag:example,2024:1', link: 'https://a.example/new' })]);

    // Assert
    expect(inserted.success).toBe(true);
    if (!inserted.success) {
      return;
    }
    expect(inserted.data).toEqual([]);
    const stored = await db.selectFrom('feedItem').selectAll().where('feed_id', '=', feedId).execute();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.title).toBe('First');
  });
});

describe('syncFeedItemsToDatabase', () => {
  test('updates a publisher edit and keeps the item identity and read state', async () => {
    // Arrange
    const feed = await addFeedToDatabase(feedA);
    if (!feed.success) {
      throw new Error('feed insert failed');
    }
    const feedId = feed.data.id;
    const original = { guid: 'stable', title: 'Old', link: 'https://a.example/old', pubDate: '2026-09-22', description: '<p>Old</p>', image: undefined, author: undefined, extra: undefined, read_at: undefined };
    const saved = await addFeedItemsToDatabase(db, feedId, [original]);
    if (!saved.success) {
      throw new Error('insert failed');
    }
    const firstItem = saved.data[0];
    if (!firstItem) {
      throw new Error('item insert failed');
    }
    const itemId = firstItem.id;
    await db.updateTable('feedItem').set({ read_at: '2026-01-01' }).where('id', '=', itemId).execute();
    await upsertArticleContent({ item_id: itemId, html: '<p>Cached</p>', text: 'Cached', word_count: 1, status: 'ok' });

    // Act
    const result = await syncFeedItemsToDatabase(db, feedId, [{ ...original, title: 'New', link: 'https://a.example/new', description: '<p>New words</p>', image: 'https://a.example/image', author: 'Author', extra: '{"source":1}' }]);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.inserted).toEqual([]);
    expect(result.data.updated).toBe(1);
    expect(await db.selectFrom('feedItem').selectAll().where('id', '=', itemId).executeTakeFirstOrThrow()).toMatchObject({ id: itemId, title: 'New', link: 'https://a.example/new', excerpt: 'New words', read_at: '2026-01-01', author: 'Author', extra: '{"source":1}' });
    expect(await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).execute()).toEqual([]);
  });

  describe('article cache', () => {
    const original = { guid: 'cached', title: 'Title', link: 'https://a.example/a', pubDate: '2026-09-22', description: 'Body', image: undefined, author: undefined, extra: undefined, read_at: undefined };

    async function seedCachedItem(): Promise<{ feedId: number; itemId: number }> {
      const feed = await addFeedToDatabase(feedA);
      if (!feed.success) {
        throw new Error('feed insert failed');
      }
      const saved = await addFeedItemsToDatabase(db, feed.data.id, [original]);
      const itemId = saved.success ? saved.data[0]?.id : undefined;
      if (itemId === undefined) {
        throw new Error('insert failed');
      }
      await upsertArticleContent({ item_id: itemId, html: '<p>Cached</p>', text: 'Cached', word_count: 1, status: 'ok' });
      return { feedId: feed.data.id, itemId };
    }

    test.each([
      ['link', { link: 'https://a.example/moved' }],
      ['description', { description: 'Rewritten body' }],
    ])('drops the cached article when only the %s changes', async (_field, change) => {
      // Arrange
      const { feedId, itemId } = await seedCachedItem();

      // Act
      await syncFeedItemsToDatabase(db, feedId, [{ ...original, ...change }]);

      // Assert
      expect(await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).execute()).toEqual([]);
    });

    test('keeps the cached article when only the title changes', async () => {
      // Arrange
      const { feedId, itemId } = await seedCachedItem();

      // Act
      const result = await syncFeedItemsToDatabase(db, feedId, [{ ...original, title: 'Renamed' }]);

      // Assert
      expect(result.success && result.data.updated).toBe(1);
      expect(await db.selectFrom('articleContent').select('html').where('item_id', '=', itemId).execute()).toEqual([{ html: '<p>Cached</p>' }]);
    });
  });

  describe('retention cutoff', () => {
    const DAY = 24 * 60 * 60 * 1000;
    const cutoff = Date.parse('2026-01-01T00:00:00Z');

    function item(guid: string, publishedAt: number | string) {
      const pubDate = typeof publishedAt === 'number' ? new Date(publishedAt).toISOString() : publishedAt;
      return { guid, title: guid, link: `https://a.example/${guid}`, pubDate, description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined };
    }

    async function createFeed(): Promise<number> {
      const feed = await addFeedToDatabase(feedA);
      if (!feed.success) {
        throw new Error('feed insert failed');
      }
      return feed.data.id;
    }

    async function storedGuids(feedId: number): Promise<string[]> {
      const rows = await db.selectFrom('feedItem').select('guid').where('feed_id', '=', feedId).orderBy('guid').execute();
      return rows.map((row) => row.guid);
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    test('keeps only the 10 newest items of a batch that is entirely older than the cutoff', async () => {
      // Arrange
      const feedId = await createFeed();
      const batch = Array.from({ length: 12 }, (_, index) => item(`g${String(index).padStart(2, '0')}`, cutoff - (30 - index) * DAY));

      // Act
      await syncFeedItemsToDatabase(db, feedId, batch, cutoff);

      // Assert
      expect(await storedGuids(feedId)).toEqual(batch.slice(2).map((row) => row.guid));
    });

    test('does not store an old item when the feed already holds 10 newer ones', async () => {
      // Arrange
      const feedId = await createFeed();
      const newer = Array.from({ length: 10 }, (_, index) => item(`new${String(index).padStart(2, '0')}`, cutoff - (10 - index) * DAY));
      await syncFeedItemsToDatabase(db, feedId, newer, cutoff);

      // Act
      await syncFeedItemsToDatabase(db, feedId, [item('older', cutoff - 100 * DAY)], cutoff);

      // Assert
      expect(await storedGuids(feedId)).toEqual(newer.map((row) => row.guid));
    });

    test('stores an item dated exactly at the cutoff even when it is not among the 10 newest', async () => {
      // Arrange
      const feedId = await createFeed();
      const newer = Array.from({ length: 10 }, (_, index) => item(`new${String(index).padStart(2, '0')}`, cutoff + (index + 1) * DAY));

      // Act
      await syncFeedItemsToDatabase(db, feedId, [item('edge', cutoff), ...newer], cutoff);

      // Assert
      expect(await storedGuids(feedId)).toContain('edge');
    });

    test('does not bring back an undated item that retention removed, even if it is the newest', async () => {
      // Arrange
      const feedId = await createFeed();
      await db.insertInto('undatedItem').values({ feed_id: feedId, guid: 'gone', first_fetched_at: cutoff - DAY }).execute();

      // Act
      const result = await syncFeedItemsToDatabase(db, feedId, [item('gone', 'not a date')], cutoff);

      // Assert
      expect(result.success && result.data.inserted).toEqual([]);
      expect(await storedGuids(feedId)).toEqual([]);
    });

    test('brings back an undated item whose first fetch is exactly at the cutoff', async () => {
      // Arrange
      const feedId = await createFeed();
      await db.insertInto('undatedItem').values({ feed_id: feedId, guid: 'edge', first_fetched_at: cutoff }).execute();

      // Act
      await syncFeedItemsToDatabase(db, feedId, [item('edge', 'not a date')], cutoff);

      // Assert
      expect(await storedGuids(feedId)).toEqual(['edge']);
    });

    test('stores an old but dated item that has a stale undated marker', async () => {
      // Arrange
      const feedId = await createFeed();
      await db.insertInto('undatedItem').values({ feed_id: feedId, guid: 'dated', first_fetched_at: cutoff - DAY }).execute();

      // Act
      await syncFeedItemsToDatabase(db, feedId, [item('dated', cutoff - 50 * DAY)], cutoff);

      // Assert
      expect(await storedGuids(feedId)).toEqual(['dated']);
    });
  });

  describe('undated items', () => {
    const undated = { guid: 'undated', title: 'Undated', link: 'https://a.example/undated', pubDate: 'not a date', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined };

    afterEach(() => {
      vi.useRealTimers();
    });

    test('keeps the date of the first fetch on later syncs', async () => {
      // Arrange
      vi.useFakeTimers({ toFake: ['Date'] });
      vi.setSystemTime(1_000_000);
      const feed = await addFeedToDatabase(feedA);
      if (!feed.success) {
        throw new Error('feed insert failed');
      }
      await syncFeedItemsToDatabase(db, feed.data.id, [undated]);

      // Act
      vi.setSystemTime(9_000_000);
      await syncFeedItemsToDatabase(db, feed.data.id, [{ ...undated, title: 'Edited' }]);

      // Assert
      const firstFetchDate = 1_000_000 - 7 * 86_400_000;
      const stored = await db.selectFrom('feedItem').select(['title', 'published_at']).where('feed_id', '=', feed.data.id).execute();
      expect(stored).toEqual([{ title: 'Edited', published_at: firstFetchDate }]);
      expect(await db.selectFrom('undatedItem').select(['guid', 'first_fetched_at']).execute()).toEqual([{ guid: 'undated', first_fetched_at: firstFetchDate }]);
    });

    test('records a first-fetch date only for the items without a usable date', async () => {
      // Arrange
      const feed = await addFeedToDatabase(feedA);
      if (!feed.success) {
        throw new Error('feed insert failed');
      }

      // Act
      await addFeedItemsToDatabase(db, feed.data.id, [{ ...undated, guid: 'dated', pubDate: '2026-02-03T00:00:00Z' }, undated]);

      // Assert
      expect((await db.selectFrom('undatedItem').select('guid').execute()).map((row) => row.guid)).toEqual(['undated']);
    });

    test('takes the real date and drops the first-fetch date once the feed supplies one', async () => {
      // Arrange
      const feed = await addFeedToDatabase(feedA);
      if (!feed.success) {
        throw new Error('feed insert failed');
      }
      await syncFeedItemsToDatabase(db, feed.data.id, [undated]);

      // Act
      await syncFeedItemsToDatabase(db, feed.data.id, [{ ...undated, pubDate: '2026-02-03T00:00:00Z' }]);

      // Assert
      expect(await db.selectFrom('undatedItem').selectAll().execute()).toEqual([]);
      const stored = await db.selectFrom('feedItem').select('published_at').where('feed_id', '=', feed.data.id).execute();
      expect(stored).toEqual([{ published_at: Date.parse('2026-02-03T00:00:00Z') }]);
    });

    test('dates the undated items of a first fetch a week back, below recent news', async () => {
      // Arrange
      const before = Date.now();
      const undated = { guid: 'backlog', title: 'Backlog', link: 'https://a.example/backlog', pubDate: '', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined };

      // Act
      const feed = await addFeedToDatabase({ ...feedA, items: [undated] });

      // Assert
      if (!feed.success) {
        throw new Error('feed insert failed');
      }
      const stored = await db.selectFrom('feedItem').selectAll().where('feed_id', '=', feed.data.id).executeTakeFirstOrThrow();
      expect(stored.published_at).toBeGreaterThanOrEqual(before - 7 * 86_400_000);
      expect(stored.published_at).toBeLessThanOrEqual(Date.now() - 7 * 86_400_000);
    });

    test('dates an undated item that appears after the first fetch at the time it was seen', async () => {
      // Arrange
      const feed = await addFeedToDatabase({ ...feedA, items: [{ guid: 'first', title: 'First', link: 'https://a.example/first', pubDate: '', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }] });
      if (!feed.success) {
        throw new Error('feed insert failed');
      }
      const before = Date.now();

      // Act
      await syncFeedItemsToDatabase(db, feed.data.id, [{ guid: 'later', title: 'Later', link: 'https://a.example/later', pubDate: '', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }]);

      // Assert
      const stored = await db.selectFrom('feedItem').selectAll().where('guid', '=', 'later').executeTakeFirstOrThrow();
      expect(stored.published_at).toBeGreaterThanOrEqual(before);
    });
  });
});

describe('updateFeedItemImage', () => {
  test('updates the image column for the given item id', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [{ title: 'Item 1', link: `${feedA.link}#1`, guid: `${feedA.link}#1`, pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const itemId = result.data.items[0]?.id;
    if (itemId === undefined) {
      throw new Error('expected an item id');
    }

    await updateFeedItemImage(itemId, 'https://example.com/new.jpg');

    const updated = await db.selectFrom('feedItem').selectAll().where('id', '=', itemId).executeTakeFirst();
    expect(updated?.image).toBe('https://example.com/new.jpg');
  });

  test("leaves other items' image untouched", async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [
        { title: 'Item 1', link: `${feedA.link}#1`, guid: `${feedA.link}#1`, pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined },
        { title: 'Item 2', link: `${feedA.link}#2`, guid: `${feedA.link}#2`, pubDate: '2024-01-02', description: '', image: 'https://example.com/existing.jpg', author: undefined, extra: undefined, read_at: undefined },
      ],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    const [item1, item2] = result.data.items;
    if (item1 === undefined || item2 === undefined) {
      throw new Error('expected two items');
    }

    await updateFeedItemImage(item1.id, 'https://example.com/new.jpg');

    const untouched = await db.selectFrom('feedItem').selectAll().where('id', '=', item2.id).executeTakeFirst();
    expect(untouched?.image).toBe('https://example.com/existing.jpg');
  });

  test('does not throw when the id matches no row', async () => {
    await expect(updateFeedItemImage(999999, 'https://example.com/new.jpg')).resolves.toBeUndefined();
  });
});

describe('upsertArticleContent', () => {
  async function createItem(): Promise<number> {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [{ title: 'Item 1', link: `${feedA.link}#1`, guid: `${feedA.link}#1`, pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
      type: 'rss',
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: true,
    });
    if (!result.success) {
      throw new Error('expected the feed to be created');
    }
    const itemId = result.data.items[0]?.id;
    if (itemId === undefined) {
      throw new Error('expected an item id');
    }
    return itemId;
  }

  test('inserts a row that reads back with the same fields', async () => {
    // Arrange
    const itemId = await createItem();

    // Act
    await upsertArticleContent({ item_id: itemId, html: '<p>Body</p>', text: 'Body', word_count: 1, status: 'ok' });

    // Assert
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirst();
    expect(stored).toEqual({ item_id: itemId, html: '<p>Body</p>', text: 'Body', word_count: 1, status: 'ok' });
  });

  test('a second upsert replaces the row instead of duplicating it', async () => {
    // Arrange
    const itemId = await createItem();
    await upsertArticleContent({ item_id: itemId, html: '<p>Old</p>', text: 'Old', word_count: 1, status: 'ok' });

    // Act
    await upsertArticleContent({ item_id: itemId, html: undefined, text: undefined, word_count: undefined, status: 'failed' });

    // Assert
    const rows = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).execute();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.status).toBe('failed');
    expect(rows[0]?.html).toBeNull();
  });
});

describe('createCategory', () => {
  test('creates a new, empty category', async () => {
    // Act
    const result = await createCategory('Newsletters', HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.name).toBe('Newsletters');
    const stored = await db.selectFrom('feedCategory').selectAll().where('id', '=', result.data.id).execute();
    expect(stored).toHaveLength(1);
  });

  test('a duplicate name returns DUPLICATE_NAME and creates nothing', async () => {
    // Arrange
    await createCategory('Newsletters', HOME_WORKSPACE_ID);

    // Act
    const result = await createCategory('Newsletters', HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error).toEqual({ name: 'DUPLICATE_NAME', message: 'A category named "Newsletters" already exists.' });
    const stored = await db.selectFrom('feedCategory').selectAll().where('name', '=', 'Newsletters').execute();
    expect(stored).toHaveLength(1);
  });

  test('another constraint failure is a DB_ERROR, not a duplicate name', async () => {
    // Act
    const result = await createCategory('Newsletters', 9999);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('DB_ERROR');
  });
});

describe('createWorkspace', () => {
  test('creates a new workspace with the given name, icon and colour', async () => {
    // Act
    const result = await createWorkspace('CI/CD watch', 'Code01', '#3b82f6');

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.name).toBe('CI/CD watch');
    expect(result.data.icon).toBe('Code01');
    expect(result.data.color).toBe('#3b82f6');
  });

  test('positions the new workspace after every existing one', async () => {
    // Arrange
    const first = await createWorkspace('First', 'Code01', '#3b82f6');
    if (!first.success) {
      throw new Error('expected the first workspace to be created');
    }

    // Act
    const second = await createWorkspace('Second', 'Terminal', '#ef4444');

    // Assert
    expect(second.success).toBe(true);
    if (!second.success) {
      return;
    }
    expect(second.data.position).toBeGreaterThan(first.data.position);
  });
});
