import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { addFeedItemsToDatabase, addFeedToDatabase, updateFeedItemImage, type NewFeedInput } from './insert';
import type { FeedItem } from './types';

const feedA: NewFeedInput = { link: 'https://a.example/feed', title: 'Feed A', items: [], categoryName: 'tech', showInHome: true };
const feedB: NewFeedInput = { link: 'https://b.example/feed', title: 'Feed B', items: [], categoryName: 'tech', showInHome: true };

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('addFeedToDatabase', () => {
  test('inserts the category, metadata and items in one call', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [{ title: 'Item 1', link: `${feedA.link}#1`, pubDate: '2024-01-01', description: 'Item 1 description', image: undefined }],
      categoryName: 'tech',
      showInHome: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe(feedA.title);
    expect(result.data.category.name).toBe('tech');
    expect(result.data.showInHome).toBe(1);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.title).toBe('Item 1');
  });

  test('feeds that share a category only create one category row', async () => {
    await addFeedToDatabase(feedA);
    await addFeedToDatabase(feedB);

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();

    expect(categories).toHaveLength(1);
    expect(metadata).toHaveLength(2);
    expect(metadata.every((row) => row.category_id === categories[0]?.id)).toBe(true);
  });

  test('items without a link do not conflict with each other', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [
        { title: 'Item 1', link: undefined, pubDate: '2024-01-01', description: '', image: undefined },
        { title: 'Item 2', link: undefined, pubDate: '2024-01-02', description: '', image: undefined },
      ],
      categoryName: 'tech',
      showInHome: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.items).toHaveLength(2);
  });

  test('resubmitting the same link updates the row instead of duplicating it', async () => {
    await addFeedToDatabase({
      link: feedA.link,
      title: 'Old title',
      items: [],
      categoryName: 'tech',
      showInHome: true,
    });

    const result = await addFeedToDatabase({
      link: feedA.link,
      title: 'New title',
      items: [],
      categoryName: 'tech',
      showInHome: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe('New title');
    expect(result.data.showInHome).toBe(0);

    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();
    expect(metadata).toHaveLength(1);
  });

  test('persists showInHome as 0 when false', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [],
      categoryName: 'tech',
      showInHome: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.showInHome).toBe(0);
  });
});

describe('addFeedItemsToDatabase', () => {
  function feedItem(overrides: Partial<Omit<FeedItem, 'id' | 'feed_id'>> = {}): Omit<FeedItem, 'id' | 'feed_id'> {
    return { title: 'Item', link: `${feedA.link}#1`, pubDate: '2024-01-01', description: '', image: undefined, ...overrides };
  }

  async function createFeed(): Promise<number> {
    const result = await addFeedToDatabase(feedA);
    if (!result.success) throw new Error('expected the feed to be created');
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
    expect(inserted.map((item) => item.title)).toEqual(['Item 1', 'Item 2']);
    expect(inserted.every((item) => typeof item.id === 'number')).toBe(true);
    expect(inserted.every((item) => item.feed_id === feedId)).toBe(true);
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
    expect(inserted.map((item) => item.title)).toEqual(['Brand new']);
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
    expect(inserted).toEqual([]);
  });

  test('returns an empty array when there is nothing to insert', async () => {
    // Arrange
    const feedId = await createFeed();

    // Act
    const inserted = await addFeedItemsToDatabase(db, feedId, []);

    // Assert
    expect(inserted).toEqual([]);
  });
});

describe('updateFeedItemImage', () => {
  test('updates the image column for the given item id', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [{ title: 'Item 1', link: `${feedA.link}#1`, pubDate: '2024-01-01', description: '', image: undefined }],
      categoryName: 'tech',
      showInHome: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const itemId = result.data.items[0]?.id;
    if (itemId === undefined) throw new Error('expected an item id');

    await updateFeedItemImage(itemId, 'https://example.com/new.jpg');

    const updated = await db.selectFrom('feedItem').selectAll().where('id', '=', itemId).executeTakeFirst();
    expect(updated?.image).toBe('https://example.com/new.jpg');
  });

  test("leaves other items' image untouched", async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [
        { title: 'Item 1', link: `${feedA.link}#1`, pubDate: '2024-01-01', description: '', image: undefined },
        { title: 'Item 2', link: `${feedA.link}#2`, pubDate: '2024-01-02', description: '', image: 'https://example.com/existing.jpg' },
      ],
      categoryName: 'tech',
      showInHome: true,
    });
    expect(result.success).toBe(true);
    if (!result.success) return;
    const [item1, item2] = result.data.items;
    if (item1 === undefined || item2 === undefined) throw new Error('expected two items');

    await updateFeedItemImage(item1.id, 'https://example.com/new.jpg');

    const untouched = await db.selectFrom('feedItem').selectAll().where('id', '=', item2.id).executeTakeFirst();
    expect(untouched?.image).toBe('https://example.com/existing.jpg');
  });

  test('does not throw when the id matches no row', async () => {
    await expect(updateFeedItemImage(999999, 'https://example.com/new.jpg')).resolves.toBeUndefined();
  });
});
