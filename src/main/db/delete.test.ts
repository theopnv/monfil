import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { deleteFeedFromDatabase } from './delete';
import { addFeedToDatabase, upsertArticleContent, type NewFeedInput } from './insert';

const feedA: NewFeedInput = {
  link: 'https://a.example/feed',
  title: 'Feed A',
  items: [{ title: 'Item 1', link: 'https://a.example/feed#1', pubDate: '2024-01-01', description: '', image: undefined, read_at: undefined }],
  categoryName: 'tech',
  showInHome: true,
};
const feedB: NewFeedInput = {
  link: 'https://b.example/feed',
  title: 'Feed B',
  items: [{ title: 'Item 1', link: 'https://b.example/feed#1', pubDate: '2024-01-01', description: '', image: undefined, read_at: undefined }],
  categoryName: 'tech',
  showInHome: true,
};

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('articleContent').execute();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('deleteFeedFromDatabase', () => {
  test('removes the feed and every one of its items through the cascade', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) throw new Error('expected the feed to be created');

    // Act
    const result = await deleteFeedFromDatabase(inserted.data.id);

    // Assert
    expect(result.success).toBe(true);
    const metadata = await db.selectFrom('feedMetadata').selectAll().where('id', '=', inserted.data.id).execute();
    const items = await db.selectFrom('feedItem').selectAll().where('feed_id', '=', inserted.data.id).execute();
    expect(metadata).toEqual([]);
    expect(items).toEqual([]);
  });

  test('leaves a second feed and its items untouched', async () => {
    // Arrange
    const insertedA = await addFeedToDatabase(feedA);
    const insertedB = await addFeedToDatabase(feedB);
    if (!insertedA.success || !insertedB.success) throw new Error('expected both feeds to be created');

    // Act
    await deleteFeedFromDatabase(insertedA.data.id);

    // Assert
    const metadata = await db.selectFrom('feedMetadata').selectAll().where('id', '=', insertedB.data.id).execute();
    const items = await db.selectFrom('feedItem').selectAll().where('feed_id', '=', insertedB.data.id).execute();
    expect(metadata).toHaveLength(1);
    expect(items).toHaveLength(1);
  });

  test('a feed with zero items still deletes', async () => {
    // Arrange
    const inserted = await addFeedToDatabase({ ...feedA, items: [] });
    if (!inserted.success) throw new Error('expected the feed to be created');

    // Act
    const result = await deleteFeedFromDatabase(inserted.data.id);

    // Assert
    expect(result.success).toBe(true);
  });

  test('an unknown id returns FEED_NOT_FOUND and writes nothing', async () => {
    // Act
    const result = await deleteFeedFromDatabase(999999);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.name).toBe('FEED_NOT_FOUND');
  });

  test('removes the article content row of its items through the cascade', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) throw new Error('expected the feed to be created');
    const itemId = inserted.data.items[0]?.id;
    if (itemId === undefined) throw new Error('expected an item id');
    await upsertArticleContent({ item_id: itemId, html: '<p>Body</p>', text: 'Body', word_count: 1, status: 'ok' });

    // Act
    await deleteFeedFromDatabase(inserted.data.id);

    // Assert
    const content = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).execute();
    expect(content).toEqual([]);
  });

  test('the category row survives', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) throw new Error('expected the feed to be created');

    // Act
    await deleteFeedFromDatabase(inserted.data.id);

    // Assert
    const categories = await db.selectFrom('feedCategory').selectAll().where('id', '=', inserted.data.category.id).execute();
    expect(categories).toHaveLength(1);
  });
});
