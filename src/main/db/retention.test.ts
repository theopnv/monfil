import { beforeAll, afterEach, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from './database';
import { addFeedToDatabase, syncFeedItemsToDatabase, upsertArticleContent } from './crud/insert';
import { pruneExpiredItems, retainedFetchedItems, retentionCutoff } from './retention';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';

beforeAll(async () => {
  await initializeDatabase(':memory:'); 
});
afterEach(async () => {
  vi.restoreAllMocks();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

test('keeps ten old items when a new source has no recent articles', () => {
  // Arrange
  const now = Date.parse('2026-09-23T12:00:00Z');
  const items = Array.from({ length: 12 }, (_, index) => ({ guid: String(index), pubDate: new Date(now - (365 + index) * 86400000).toISOString() }));

  // Act
  const retained = retainedFetchedItems(items, retentionCutoff(30, now), now);

  // Assert
  expect(retained.map((item) => item.guid)).toEqual(Array.from({ length: 10 }, (_, index) => String(index)));
});

test('keeps an undated item deleted until a longer retention includes it', async () => {
  // Arrange
  const first = Date.parse('2026-01-01T00:00:00Z');
  const later = first + 31 * 86400000;
  const clock = vi.spyOn(Date, 'now').mockReturnValue(first);
  const feed = await addFeedToDatabase({ link: 'https://undated.example/feed', title: 'Undated', type: 'rss', items: [], categoryName: 'Undated', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true });
  if (!feed.success) {
    throw new Error('feed insert failed');
  }
  const items = Array.from({ length: 11 }, (_, index) => ({
    guid: String(index), title: String(index), link: undefined, pubDate: 'invalid', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined,
  }));
  const firstSync = await syncFeedItemsToDatabase(db, feed.data.id, items, retentionCutoff(30, first));
  expect(firstSync.success).toBe(true);
  clock.mockReturnValue(later);
  expect(await pruneExpiredItems(30, later)).toBe(1);

  // Act
  const repeated = await syncFeedItemsToDatabase(db, feed.data.id, items, retentionCutoff(30, later));
  const widened = await syncFeedItemsToDatabase(db, feed.data.id, items, retentionCutoff(60, later));

  // Assert
  expect(repeated).toMatchObject({ success: true, data: { inserted: [] } });
  expect(widened.success && widened.data.inserted).toHaveLength(1);
  expect(await db.selectFrom('feedItem').select('id').execute()).toHaveLength(11);
  expect(await db.selectFrom('undatedItem').select('guid').execute()).toHaveLength(11);
});

test('prunes read and unread items at the publication boundary and cascades article content', async () => {
  // Arrange
  const now = Date.parse('2026-09-23T12:00:00Z');
  const feed = await addFeedToDatabase({ link: 'https://a.example/feed', title: 'A', type: 'rss', items: [], categoryName: 'A', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true });
  if (!feed.success) {
    throw new Error('feed insert failed');
  }
  const rows = await db.insertInto('feedItem').values([
    ...Array.from({ length: 10 }, (_, index) => ({ feed_id: feed.data.id, guid: `recent-${index}`, title: 'Recent', pubDate: '2026-09-22', description: '', published_at: now - 86400000 })),
    { feed_id: feed.data.id, guid: 'old', title: 'Old', pubDate: '2026-08-01', description: '', published_at: now - 31 * 86400000, read_at: '2026-09-01' },
    { feed_id: feed.data.id, guid: 'edge', title: 'Edge', pubDate: '2026-08-24', description: '', published_at: now - 30 * 86400000 },
    { feed_id: feed.data.id, guid: 'unknown', title: 'Unknown', pubDate: '', description: '', published_at: now - 31 * 86400000 },
  ]).returningAll().execute();
  const old = rows.find((row) => row.guid === 'old');
  if (!old) {
    throw new Error('item insert failed');
  }
  await upsertArticleContent({ item_id: old.id, html: 'old', text: 'old', word_count: 1, status: 'ok' });

  // Act
  const removed = await pruneExpiredItems(30, now);

  // Assert
  expect(removed).toBe(2);
  expect((await db.selectFrom('feedItem').select('guid').orderBy('id').execute()).map((row) => row.guid)).toEqual([...Array.from({ length: 10 }, (_, index) => `recent-${index}`), 'edge']);
  expect(await db.selectFrom('articleContent').selectAll().execute()).toEqual([]);
});

test('keeps the ten newest old items per source', async () => {
  // Arrange
  const now = Date.parse('2026-09-23T12:00:00Z');
  const feed = await addFeedToDatabase({ link: 'https://quiet.example/feed', title: 'Quiet', type: 'rss', items: [], categoryName: 'Quiet', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true });
  if (!feed.success) {
    throw new Error('feed insert failed');
  }
  await db.insertInto('feedItem').values(Array.from({ length: 12 }, (_, index) => ({
    feed_id: feed.data.id, guid: String(index), title: String(index), pubDate: '2020-01-01', description: '', published_at: now - index * 86400000 - 365 * 86400000,
  }))).execute();

  // Act
  const removed = await pruneExpiredItems(30, now);

  // Assert
  expect(removed).toBe(2);
  expect((await db.selectFrom('feedItem').select('guid').orderBy('published_at', 'desc').execute()).map((row) => row.guid)).toEqual(Array.from({ length: 10 }, (_, index) => String(index)));
});

test('prunes a large feed and reclaims free pages', async () => {
  // Arrange
  const now = Date.parse('2026-09-23T12:00:00Z');
  const feed = await addFeedToDatabase({ link: 'https://large.example/feed', title: 'Large', type: 'rss', items: [], categoryName: 'Large', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true });
  if (!feed.success) {
    throw new Error('feed insert failed');
  }
  await db.insertInto('feedItem').values(Array.from({ length: 1_011 }, (_, index) => ({
    feed_id: feed.data.id, guid: String(index), title: 'Old', pubDate: '2020-01-01', description: 'x'.repeat(1_000), published_at: Date.parse('2020-01-01'),
  }))).execute();

  // Act
  const removed = await pruneExpiredItems(30, now);

  // Assert
  expect(removed).toBe(1_001);
  expect(await db.selectFrom('feedItem').select('id').execute()).toHaveLength(10);
});
