import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { deleteCategory, deleteFeedFromDatabase, deleteWorkspace } from './delete';
import { addFeedToDatabase, createCategory, createWorkspace, upsertArticleContent, type NewFeedInput } from './insert';
import { moveFeedToWorkspace } from './update';
import { HOME_WORKSPACE_ID } from '../types';

const feedA: NewFeedInput = {
  link: 'https://a.example/feed',
  title: 'Feed A',
  items: [{ title: 'Item 1', link: 'https://a.example/feed#1', guid: 'https://a.example/feed#1', pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
  type: 'rss',
  categoryName: 'tech',
  workspaceId: HOME_WORKSPACE_ID,
  showInWorkspace: true,
};
const feedB: NewFeedInput = {
  link: 'https://b.example/feed',
  title: 'Feed B',
  items: [{ title: 'Item 1', link: 'https://b.example/feed#1', guid: 'https://b.example/feed#1', pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
  type: 'rss',
  categoryName: 'tech',
  workspaceId: HOME_WORKSPACE_ID,
  showInWorkspace: true,
};

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

describe('deleteFeedFromDatabase', () => {
  test('removes the feed and every one of its items through the cascade', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

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
    if (!insertedA.success || !insertedB.success) {
      throw new Error('expected both feeds to be created');
    }

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
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

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
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
  });

  test('removes the article content row of its items through the cascade', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    const itemId = inserted.data.items[0]?.id;
    if (itemId === undefined) {
      throw new Error('expected an item id');
    }
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
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    await deleteFeedFromDatabase(inserted.data.id);

    // Assert
    const categories = await db.selectFrom('feedCategory').selectAll().where('id', '=', inserted.data.category.id).execute();
    expect(categories).toHaveLength(1);
  });
});

describe('deleteCategory', () => {
  test('reassigns its feeds to the destination category then removes it', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    const destination = await createCategory('Destination');
    if (!destination.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await deleteCategory(inserted.data.category.id, destination.data.id);

    // Assert
    expect(result.success).toBe(true);
    const category = await db.selectFrom('feedCategory').selectAll().where('id', '=', inserted.data.category.id).execute();
    expect(category).toEqual([]);
    const placement = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).executeTakeFirstOrThrow();
    expect(placement.category_id).toBe(destination.data.id);
  });

  test('an empty category still deletes', async () => {
    // Arrange
    const empty = await createCategory('Empty');
    const destination = await createCategory('Destination');
    if (!empty.success || !destination.success) {
      throw new Error('expected both categories to be created');
    }

    // Act
    const result = await deleteCategory(empty.data.id, destination.data.id);

    // Assert
    expect(result.success).toBe(true);
  });

  test('an unknown id returns CATEGORY_NOT_FOUND and writes nothing', async () => {
    // Arrange
    const destination = await createCategory('Destination');
    if (!destination.success) {
      throw new Error('expected the category to be created');
    }

    // Act
    const result = await deleteCategory(999999, destination.data.id);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('CATEGORY_NOT_FOUND');
  });
});

describe('deleteWorkspace', () => {
  test('refuses to delete Home', async () => {
    // Act
    const result = await deleteWorkspace(HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('HOME_NOT_DELETABLE');
    const home = await db.selectFrom('workspace').selectAll().where('id', '=', HOME_WORKSPACE_ID).executeTakeFirst();
    expect(home).toBeDefined();
  });

  test('an unknown id returns WORKSPACE_NOT_FOUND', async () => {
    // Act
    const result = await deleteWorkspace(999999);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('WORKSPACE_NOT_FOUND');
  });

  test('removes the workspace along with its categories and placements', async () => {
    // Arrange
    const workspace = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!workspace.success) {
      throw new Error('expected the workspace to be created');
    }
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    await moveFeedToWorkspace(inserted.data.id, HOME_WORKSPACE_ID, workspace.data.id, 'Imported');

    // Act
    const result = await deleteWorkspace(workspace.data.id);

    // Assert
    expect(result.success).toBe(true);
    const remaining = await db.selectFrom('workspace').selectAll().where('id', '=', workspace.data.id).execute();
    expect(remaining).toEqual([]);
    const categories = await db.selectFrom('feedCategory').selectAll().where('workspace_id', '=', workspace.data.id).execute();
    expect(categories).toEqual([]);
    const placements = await db.selectFrom('feedPlacement').selectAll().where('workspace_id', '=', workspace.data.id).execute();
    expect(placements).toEqual([]);
  });

  test('collects a feed left with zero placements anywhere', async () => {
    // Arrange
    const workspace = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!workspace.success) {
      throw new Error('expected the workspace to be created');
    }
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    await moveFeedToWorkspace(inserted.data.id, HOME_WORKSPACE_ID, workspace.data.id, 'Imported');

    // Act
    await deleteWorkspace(workspace.data.id);

    // Assert
    const feed = await db.selectFrom('feedMetadata').selectAll().where('id', '=', inserted.data.id).execute();
    expect(feed).toEqual([]);
  });

  test('leaves a feed placed in another workspace too untouched', async () => {
    // Arrange
    const workspace = await createWorkspace('Other', 'Code01', '#3b82f6');
    if (!workspace.success) {
      throw new Error('expected the workspace to be created');
    }
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    const category = await db.insertInto('feedCategory').values({ name: 'Shared', workspace_id: workspace.data.id }).returningAll().executeTakeFirstOrThrow();
    await db.insertInto('feedPlacement').values({ feed_id: inserted.data.id, category_id: category.id, workspace_id: workspace.data.id, showInWorkspace: 1 }).execute();

    // Act
    const result = await deleteWorkspace(workspace.data.id);

    // Assert
    expect(result.success).toBe(true);
    const feed = await db.selectFrom('feedMetadata').selectAll().where('id', '=', inserted.data.id).execute();
    expect(feed).toHaveLength(1);
    const homePlacement = await db.selectFrom('feedPlacement').selectAll().where('feed_id', '=', inserted.data.id).where('workspace_id', '=', HOME_WORKSPACE_ID).execute();
    expect(homePlacement).toHaveLength(1);
  });
});
