import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { moveFeedsToCategory, renameCategory, setFeedItemsRead, setFeedsShowInWorkspace } from './update';
import { addFeedToDatabase, createCategory, type NewFeedInput } from './insert';

const feedA: NewFeedInput = {
  link: 'https://a.example/feed',
  title: 'Feed A',
  items: [],
  type: 'rss',
  categoryName: 'tech',
  showInWorkspace: true,
};
const feedB: NewFeedInput = {
  link: 'https://b.example/feed',
  title: 'Feed B',
  items: [],
  type: 'rss',
  categoryName: 'tech',
  showInWorkspace: true,
};

const feedWithItems: NewFeedInput = {
  link: 'https://c.example/feed',
  title: 'Feed C',
  items: [
    { title: 'Item 1', link: 'https://c.example/1', guid: 'https://c.example/1', pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined },
    { title: 'Item 2', link: 'https://c.example/2', guid: 'https://c.example/2', pubDate: '2024-01-02', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined },
  ],
  type: 'rss',
  categoryName: 'tech',
  showInWorkspace: true,
};

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedPlacement').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('setFeedsShowInWorkspace', () => {
  test('sets showInWorkspace to 0 then back to 1', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const hidden = await setFeedsShowInWorkspace([inserted.data.id], false);
    const hiddenRow = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Assert
    expect(hidden.success).toBe(true);
    expect(hiddenRow.showInWorkspace).toBe(0);

    // Act
    const shown = await setFeedsShowInWorkspace([inserted.data.id], true);
    const shownRow = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Assert
    expect(shown.success).toBe(true);
    expect(shownRow.showInWorkspace).toBe(1);
  });

  test('updates a batch of several ids in one call', async () => {
    // Arrange
    const insertedA = await addFeedToDatabase(feedA);
    const insertedB = await addFeedToDatabase(feedB);
    if (!insertedA.success || !insertedB.success) {
      throw new Error('expected both feeds to be created');
    }

    // Act
    const result = await setFeedsShowInWorkspace([insertedA.data.id, insertedB.data.id], false);

    // Assert
    expect(result.success).toBe(true);
    const rows = await db.selectFrom('feedPlacement').selectAll().where('feed_id', 'in', [insertedA.data.id, insertedB.data.id]).execute();
    expect(rows.every((row) => row.showInWorkspace === 0)).toBe(true);
  });

  test('an unknown id returns FEED_NOT_FOUND', async () => {
    // Act
    const result = await setFeedsShowInWorkspace([999999], false);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await setFeedsShowInWorkspace([], false);

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

describe('renameCategory', () => {
  test('renames the category and returns the updated row', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await renameCategory(inserted.data.category.id, 'Renamed');

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data.name).toBe('Renamed');
    const row = await db.selectFrom('feedCategory').selectAll().where('id', '=', inserted.data.category.id).executeTakeFirstOrThrow();
    expect(row.name).toBe('Renamed');
  });

  test('an unknown id returns CATEGORY_NOT_FOUND', async () => {
    // Act
    const result = await renameCategory(999999, 'Renamed');

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('CATEGORY_NOT_FOUND');
  });

  test('renaming to a name already in use returns DUPLICATE_NAME and leaves the row untouched', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    const other = await createCategory('Existing');
    if (!other.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await renameCategory(inserted.data.category.id, 'Existing');

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('DUPLICATE_NAME');
    const row = await db.selectFrom('feedCategory').selectAll().where('id', '=', inserted.data.category.id).executeTakeFirstOrThrow();
    expect(row.name).toBe('tech');
  });
});

describe('moveFeedsToCategory', () => {
  test('moves a batch of feeds into the destination category', async () => {
    // Arrange
    const insertedA = await addFeedToDatabase(feedA);
    const insertedB = await addFeedToDatabase(feedB);
    if (!insertedA.success || !insertedB.success) {
      throw new Error('expected both feeds to be created');
    }
    const destination = await createCategory('Destination');
    if (!destination.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await moveFeedsToCategory([insertedA.data.id, insertedB.data.id], destination.data.id);

    // Assert
    expect(result.success).toBe(true);
    const rows = await db.selectFrom('feedPlacement').selectAll().where('feed_id', 'in', [insertedA.data.id, insertedB.data.id]).execute();
    expect(rows.every((row) => row.category_id === destination.data.id)).toBe(true);
  });

  test('a destination category that does not exist returns CATEGORY_NOT_FOUND', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await moveFeedsToCategory([inserted.data.id], 999999);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('CATEGORY_NOT_FOUND');
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await moveFeedsToCategory([], 1);

    // Assert
    expect(result.success).toBe(true);
  });
});
