import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { setFeedItemsRead, setFeedsShowInHome } from './update';
import { addFeedToDatabase, type NewFeedInput } from './insert';

const feedA: NewFeedInput = {
  link: 'https://a.example/feed',
  title: 'Feed A',
  items: [],
  categoryName: 'tech',
  showInHome: true,
};
const feedB: NewFeedInput = {
  link: 'https://b.example/feed',
  title: 'Feed B',
  items: [],
  categoryName: 'tech',
  showInHome: true,
};

const feedWithItems: NewFeedInput = {
  link: 'https://c.example/feed',
  title: 'Feed C',
  items: [
    { title: 'Item 1', link: 'https://c.example/1', pubDate: '2024-01-01', description: '', image: undefined, read_at: undefined },
    { title: 'Item 2', link: 'https://c.example/2', pubDate: '2024-01-02', description: '', image: undefined, read_at: undefined },
  ],
  categoryName: 'tech',
  showInHome: true,
};

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('setFeedsShowInHome', () => {
  test('sets showInHome to 0 then back to 1', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const hidden = await setFeedsShowInHome([inserted.data.id], false);
    const hiddenRow = await db.selectFrom('feedMetadata').selectAll().where('id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Assert
    expect(hidden.success).toBe(true);
    expect(hiddenRow.showInHome).toBe(0);

    // Act
    const shown = await setFeedsShowInHome([inserted.data.id], true);
    const shownRow = await db.selectFrom('feedMetadata').selectAll().where('id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Assert
    expect(shown.success).toBe(true);
    expect(shownRow.showInHome).toBe(1);
  });

  test('updates a batch of several ids in one call', async () => {
    // Arrange
    const insertedA = await addFeedToDatabase(feedA);
    const insertedB = await addFeedToDatabase(feedB);
    if (!insertedA.success || !insertedB.success) {
      throw new Error('expected both feeds to be created');
    }

    // Act
    const result = await setFeedsShowInHome([insertedA.data.id, insertedB.data.id], false);

    // Assert
    expect(result.success).toBe(true);
    const rows = await db.selectFrom('feedMetadata').selectAll().where('id', 'in', [insertedA.data.id, insertedB.data.id]).execute();
    expect(rows.every((row) => row.showInHome === 0)).toBe(true);
  });

  test('an unknown id returns FEED_NOT_FOUND', async () => {
    // Act
    const result = await setFeedsShowInHome([999999], false);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await setFeedsShowInHome([], false);

    // Assert
    expect(result.success).toBe(true);
  });
});

describe('setFeedItemsRead', () => {
  test('updates a batch of several ids in one call', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedWithItems);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    const itemIds = inserted.data.items.map((item) => item.id);

    // Act
    const result = await setFeedItemsRead(itemIds, true);

    // Assert
    expect(result.success).toBe(true);
    const rows = await db.selectFrom('feedItem').selectAll().where('id', 'in', itemIds).execute();
    expect(rows.every((row) => typeof row.read_at === 'string')).toBe(true);
  });

  test('an unknown id returns ITEM_NOT_FOUND', async () => {
    // Act
    const result = await setFeedItemsRead([999999], true);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('ITEM_NOT_FOUND');
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await setFeedItemsRead([], true);

    // Assert
    expect(result.success).toBe(true);
  });

  test('marking read then unread clears read_at', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedWithItems);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    const itemId = inserted.data.items[0]?.id;
    if (itemId === undefined) {
      throw new Error('expected an item id');
    }
    await setFeedItemsRead([itemId], true);

    // Act
    const result = await setFeedItemsRead([itemId], false);
    const row = await db.selectFrom('feedItem').selectAll().where('id', '=', itemId).executeTakeFirstOrThrow();

    // Assert
    expect(result.success).toBe(true);
    expect(row.read_at).toBeNull();
  });
});
