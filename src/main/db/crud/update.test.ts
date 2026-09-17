import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { moveFeedsToCategory, moveFeedToWorkspace, renameCategory, reorderWorkspaces, setFeedItemsRead, setFeedsShowInWorkspace, updateWorkspace } from './update';
import { addFeedToDatabase, createCategory, createWorkspace, type NewFeedInput } from './insert';
import { HOME_WORKSPACE_ID } from '../types';

const feedA: NewFeedInput = {
  link: 'https://a.example/feed',
  title: 'Feed A',
  items: [],
  type: 'rss',
  categoryName: 'tech',
  workspaceId: HOME_WORKSPACE_ID,
  showInWorkspace: true,
};
const feedB: NewFeedInput = {
  link: 'https://b.example/feed',
  title: 'Feed B',
  items: [],
  type: 'rss',
  categoryName: 'tech',
  workspaceId: HOME_WORKSPACE_ID,
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
  workspaceId: HOME_WORKSPACE_ID,
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
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
});

describe('setFeedsShowInWorkspace', () => {
  test('sets showInWorkspace to 0 then back to 1', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const hidden = await setFeedsShowInWorkspace([inserted.data.id], false, HOME_WORKSPACE_ID);
    const hiddenRow = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Assert
    expect(hidden.success).toBe(true);
    expect(hiddenRow.showInWorkspace).toBe(0);

    // Act
    const shown = await setFeedsShowInWorkspace([inserted.data.id], true, HOME_WORKSPACE_ID);
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
    const result = await setFeedsShowInWorkspace([insertedA.data.id, insertedB.data.id], false, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(true);
    const rows = await db.selectFrom('feedPlacement').selectAll().where('feed_id', 'in', [insertedA.data.id, insertedB.data.id]).execute();
    expect(rows.every((row) => row.showInWorkspace === 0)).toBe(true);
  });

  test('an unknown id returns FEED_NOT_FOUND', async () => {
    // Act
    const result = await setFeedsShowInWorkspace([999999], false, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await setFeedsShowInWorkspace([], false, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(true);
  });

  test('a batch where only some ids are placed here returns FEED_NOT_FOUND', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await setFeedsShowInWorkspace([inserted.data.id, 999999], false, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
  });

  test('a repeated id counts once', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await setFeedsShowInWorkspace([inserted.data.id, inserted.data.id], false, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(true);
  });

  test('a feed placed only in another workspace returns FEED_NOT_FOUND', async () => {
    // Arrange
    const other = await createWorkspace('Other', 'Stars01', '#000000');
    if (!other.success) {
      throw new Error('expected the workspace to be created');
    }
    const inserted = await addFeedToDatabase({ ...feedA, workspaceId: other.data.id });
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await setFeedsShowInWorkspace([inserted.data.id], false, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
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
    const result = await renameCategory(inserted.data.category.id, 'Renamed', HOME_WORKSPACE_ID);

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
    const result = await renameCategory(999999, 'Renamed', HOME_WORKSPACE_ID);

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
    const other = await createCategory('Existing', HOME_WORKSPACE_ID);
    if (!other.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await renameCategory(inserted.data.category.id, 'Existing', HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('DUPLICATE_NAME');
    const row = await db.selectFrom('feedCategory').selectAll().where('id', '=', inserted.data.category.id).executeTakeFirstOrThrow();
    expect(row.name).toBe('tech');
  });

  test('a category owned by another workspace returns CATEGORY_NOT_FOUND and is left untouched', async () => {
    // Arrange
    const other = await createWorkspace('Other', 'Stars01', '#000000');
    if (!other.success) {
      throw new Error('expected the workspace to be created');
    }
    const foreign = await createCategory('Foreign', other.data.id);
    if (!foreign.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await renameCategory(foreign.data.id, 'Renamed', HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('CATEGORY_NOT_FOUND');
    const row = await db.selectFrom('feedCategory').selectAll().where('id', '=', foreign.data.id).executeTakeFirstOrThrow();
    expect(row.name).toBe('Foreign');
  });

  test('the same name in another workspace is not a duplicate', async () => {
    // Arrange
    const other = await createWorkspace('Other', 'Stars01', '#000000');
    if (!other.success) {
      throw new Error('expected the workspace to be created');
    }
    await createCategory('Shared', HOME_WORKSPACE_ID);
    const foreign = await createCategory('Foreign', other.data.id);
    if (!foreign.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await renameCategory(foreign.data.id, 'Shared', other.data.id);

    // Assert
    expect(result.success).toBe(true);
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
    const destination = await createCategory('Destination', HOME_WORKSPACE_ID);
    if (!destination.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await moveFeedsToCategory([insertedA.data.id, insertedB.data.id], destination.data.id, HOME_WORKSPACE_ID);

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
    const result = await moveFeedsToCategory([inserted.data.id], 999999, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('CATEGORY_NOT_FOUND');
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await moveFeedsToCategory([], 1, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(true);
  });

  test('a destination category owned by another workspace returns CATEGORY_NOT_FOUND and moves nothing', async () => {
    // Arrange
    const other = await createWorkspace('Other', 'Stars01', '#000000');
    const inserted = await addFeedToDatabase(feedA);
    if (!other.success || !inserted.success) {
      throw new Error('expected the workspace and feed to be created');
    }
    const foreign = await createCategory('Foreign', other.data.id);
    if (!foreign.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await moveFeedsToCategory([inserted.data.id], foreign.data.id, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('CATEGORY_NOT_FOUND');
    const row = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).executeTakeFirstOrThrow();
    expect(row.category_id).toBe(inserted.data.category.id);
  });
});

describe('updateWorkspace', () => {
  test('updates the given fields and returns the updated row', async () => {
    // Arrange
    const created = await createWorkspace('CI/CD watch', 'Code01', '#3b82f6');
    if (!created.success) {
      throw new Error('expected the workspace to be created');
    }

    // Act
    const result = await updateWorkspace(created.data.id, { name: 'Renamed', icon: 'Terminal', color: '#ef4444' });

    // Assert
    expect(result.success).toBe(true);
    if (!result.success) {
      return;
    }
    expect(result.data).toMatchObject({ name: 'Renamed', icon: 'Terminal', color: '#ef4444' });
  });

  test('an unknown id returns WORKSPACE_NOT_FOUND', async () => {
    // Act
    const result = await updateWorkspace(999999, { name: 'Renamed' });

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('WORKSPACE_NOT_FOUND');
  });
});

describe('reorderWorkspaces', () => {
  test('sets each workspace position to its index in the given order', async () => {
    // Arrange
    const first = await createWorkspace('First', 'Code01', '#3b82f6');
    const second = await createWorkspace('Second', 'Terminal', '#ef4444');
    if (!first.success || !second.success) {
      throw new Error('expected both workspaces to be created');
    }

    // Act
    const result = await reorderWorkspaces([second.data.id, HOME_WORKSPACE_ID, first.data.id]);

    // Assert
    expect(result.success).toBe(true);
    const rows = await db.selectFrom('workspace').select(['id', 'position']).execute();
    const positionOf = (id: number) => rows.find((row) => row.id === id)?.position;
    expect(positionOf(second.data.id)).toBe(0);
    expect(positionOf(HOME_WORKSPACE_ID)).toBe(1);
    expect(positionOf(first.data.id)).toBe(2);
  });

  test('an unknown id returns WORKSPACE_NOT_FOUND and leaves positions untouched', async () => {
    // Arrange
    const before = await db.selectFrom('workspace').select(['id', 'position']).execute();

    // Act
    const result = await reorderWorkspaces([HOME_WORKSPACE_ID, 999999]);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('WORKSPACE_NOT_FOUND');
    const after = await db.selectFrom('workspace').select(['id', 'position']).execute();
    expect(after).toEqual(before);
  });

  test('an empty id list succeeds without writing', async () => {
    // Act
    const result = await reorderWorkspaces([]);

    // Assert
    expect(result.success).toBe(true);
  });
});

describe('moveFeedToWorkspace', () => {
  test('removes the placement in the source workspace and adds one in the destination', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    const destination = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!inserted.success || !destination.success) {
      throw new Error('expected the feed and the destination workspace to be created');
    }

    // Act
    const result = await moveFeedToWorkspace(inserted.data.id, HOME_WORKSPACE_ID, destination.data.id, 'General');

    // Assert
    expect(result.success).toBe(true);
    const placements = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).execute();
    expect(placements).toHaveLength(1);
    expect(placements[0]?.workspace_id).toBe(destination.data.id);
  });

  test('creates the destination category when it does not exist yet', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    const destination = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!inserted.success || !destination.success) {
      throw new Error('expected the feed and the destination workspace to be created');
    }

    // Act
    const result = await moveFeedToWorkspace(inserted.data.id, HOME_WORKSPACE_ID, destination.data.id, 'Imported');

    // Assert
    expect(result.success).toBe(true);
    const category = await db.selectFrom('feedCategory').selectAll().where('workspace_id', '=', destination.data.id).where('name', '=', 'Imported').executeTakeFirst();
    expect(category).toBeDefined();
  });

  test('reuses an existing category with the same name in the destination', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    const destination = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!inserted.success || !destination.success) {
      throw new Error('expected the feed and the destination workspace to be created');
    }
    const existing = await db.insertInto('feedCategory').values({ name: 'Existing', workspace_id: destination.data.id }).returningAll().executeTakeFirstOrThrow();

    // Act
    await moveFeedToWorkspace(inserted.data.id, HOME_WORKSPACE_ID, destination.data.id, 'Existing');

    // Assert
    const categories = await db.selectFrom('feedCategory').selectAll().where('workspace_id', '=', destination.data.id).execute();
    expect(categories).toHaveLength(1);
    const placement = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).executeTakeFirstOrThrow();
    expect(placement.category_id).toBe(existing.id);
  });

  test('carries showInWorkspace across, so a hidden feed stays hidden', async () => {
    // Arrange
    const inserted = await addFeedToDatabase({ ...feedA, showInWorkspace: false });
    const destination = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!inserted.success || !destination.success) {
      throw new Error('expected the feed and the destination workspace to be created');
    }

    // Act
    await moveFeedToWorkspace(inserted.data.id, HOME_WORKSPACE_ID, destination.data.id, 'General');

    // Assert
    const placement = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).executeTakeFirstOrThrow();
    expect(placement.showInWorkspace).toBe(0);
  });

  test('a move into the workspace the feed already sits in refiles it without unhiding it', async () => {
    // Arrange
    const inserted = await addFeedToDatabase({ ...feedA, showInWorkspace: false });
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await moveFeedToWorkspace(inserted.data.id, HOME_WORKSPACE_ID, HOME_WORKSPACE_ID, 'Refiled');

    // Assert
    expect(result.success).toBe(true);
    const placements = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).execute();
    expect(placements).toHaveLength(1);
    expect(placements[0]?.showInWorkspace).toBe(0);
    const category = await db.selectFrom('feedCategory').selectAll().where('id', '=', placements[0]?.category_id ?? 0).executeTakeFirstOrThrow();
    expect(category.name).toBe('Refiled');
  });

  test('a source workspace the feed is not placed in returns FEED_NOT_FOUND and writes nothing', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    const destination = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!inserted.success || !destination.success) {
      throw new Error('expected the feed and the destination workspace to be created');
    }

    // Act
    const result = await moveFeedToWorkspace(inserted.data.id, 999999, destination.data.id, 'General');

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
    const placements = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).execute();
    expect(placements).toHaveLength(1);
    expect(placements[0]?.workspace_id).toBe(HOME_WORKSPACE_ID);
    const categories = await db.selectFrom('feedCategory').selectAll().where('workspace_id', '=', destination.data.id).execute();
    expect(categories).toEqual([]);
  });
});
