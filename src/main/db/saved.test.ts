// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, expect, test } from 'vitest';
import type { FeedItem } from './types';
import { db, initializeDatabase } from './database';
import { addFeedToDatabase, createWorkspace, upsertArticleContent } from './crud/insert';
import { deleteFeedFromDatabase, deleteWorkspace } from './crud/delete';
import { queryRiverPage, querySubscribedFeedMetadata } from './crud/query';
import { moveFeedToWorkspace } from './crud/update';
import { pruneExpiredItems } from './retention';
import { querySavedPage, setItemSaved } from './saved';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('savedItem').execute();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedPlacement').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
});

async function seed(workspaceId = HOME_WORKSPACE_ID) {
  const result = await addFeedToDatabase({
    workspaceId, link: 'https://example.com/feed', title: 'Example source', type: 'rss',
    categoryName: 'Tech', showInWorkspace: true,
    items: Array.from({ length: 12 }, (_, index) => ({
      title: index === 0 ? 'Older 50% article' : `Article ${index}`, guid: String(index),
      link: `https://example.com/${index}`, pubDate: new Date(Date.UTC(2020, 0, index + 1)).toISOString(),
      description: 'Useful reference', image: undefined, author: undefined, extra: undefined,
      read_at: index === 0 ? '2020-02-01T00:00:00.000Z' : undefined,
    })),
  });
  if (!result.success) {
    throw new Error(result.error.message);
  }
  const [first, second, ...rest] = result.data.items;
  if (!first || !second) {
    throw new Error('The feed fixture needs two items.');
  }
  const items: [FeedItem, FeedItem, ...FeedItem[]] = [first, second, ...rest];
  return { ...result.data, items };
}

async function otherWorkspace() {
  const result = await createWorkspace('Other', 'Home02', '#d67f48');
  if (!result.success) {
    throw new Error(result.error.message);
  }
  return result.data.id;
}

test('saves read and unread items while keeping their feed and read state', async () => {
  // Arrange
  const feed = await seed();
  const read = feed.items[0];
  const unread = feed.items[1];

  // Act
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId: read.id, saved: true }, 1);
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId: unread.id, saved: true }, 2);
  const saved = await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50 });
  const river = await queryRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50 });

  // Assert
  expect(saved.rows.map((row) => row.id)).toEqual([unread.id, read.id]);
  expect(saved.rows[0]?.readAt).toBeFalsy();
  expect(saved.rows[1]?.readAt).toBe(read.read_at);
  expect(river.rows).toHaveLength(12);
  expect(river.rows.find((row) => row.id === read.id)?.savedAt).toBe(1);
});

test('saving twice keeps the original save time', async () => {
  // Arrange
  const feed = await seed();
  const input = { workspaceId: HOME_WORKSPACE_ID, itemId: feed.items[0].id, saved: true };

  // Act
  await setItemSaved(input, 1);
  await setItemSaved(input, 2);

  // Assert
  expect((await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50 })).rows).toMatchObject([{ savedAt: 1 }]);
});

test('pages by save time and item id and searches saved content', async () => {
  // Arrange
  const feed = await seed();
  for (const item of feed.items.slice(0, 3)) {
    await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId: item.id, saved: true }, 10);
  }

  // Act
  const first = await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 2 });
  const cursor = first.nextCursor;
  if (!cursor || cursor.savedAt === undefined) {
    throw new Error('Expected a Saved cursor.');
  }
  const second = await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 2, cursor: { ...cursor, savedAt: cursor.savedAt } });
  const searched = await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50, search: '50% reference' });

  // Assert
  expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual(feed.items.slice(0, 3).map((item) => item.id).reverse());
  expect(second.nextCursor).toBeUndefined();
  expect(searched.rows.map((row) => row.id)).toEqual([feed.items[0].id]);
});

test('saved membership is independent in workspaces that share a feed', async () => {
  // Arrange
  const feed = await seed();
  const otherId = await otherWorkspace();
  await seed(otherId);

  // Act
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId: feed.items[0].id, saved: true });

  // Assert
  expect((await querySavedPage({ workspaceId: otherId, limit: 50 })).rows).toEqual([]);
  expect((await queryRiverPage({ workspaceId: otherId, limit: 50 })).rows.every((row) => row.savedAt === undefined)).toBe(true);
});

test('keeps saved items and cached text through cleanup and source removal', async () => {
  // Arrange
  const feed = await seed();
  const itemId = feed.items[0].id;
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId, saved: true });
  await upsertArticleContent({ item_id: itemId, html: '<p>Kept text</p>', text: 'Kept text', word_count: 2, status: 'ok' });

  // Act
  await pruneExpiredItems(15);
  await deleteFeedFromDatabase(feed.id, HOME_WORKSPACE_ID);

  // Assert
  expect((await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50, ids: [itemId] })).rows).toMatchObject([{ id: itemId, feedTitle: 'Example source' }]);
  expect(await db.selectFrom('feedItem').select('id').execute()).toEqual([{ id: itemId }]);
  expect(await db.selectFrom('articleContent').select('html').execute()).toEqual([{ html: '<p>Kept text</p>' }]);
  expect(await querySubscribedFeedMetadata()).toEqual([]);
});

test('removing the final save collects an unplaced source and its cached content', async () => {
  // Arrange
  const feed = await seed();
  const input = { workspaceId: HOME_WORKSPACE_ID, itemId: feed.items[0].id, saved: true };
  await setItemSaved(input);
  await deleteFeedFromDatabase(feed.id, HOME_WORKSPACE_ID);

  // Act
  await setItemSaved({ ...input, saved: false });

  // Assert
  expect(await db.selectFrom('feedMetadata').select('id').execute()).toEqual([]);
  expect((await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50 })).rows).toEqual([]);
});

test('saving in another workspace protects an item after unsaving it here', async () => {
  // Arrange
  const feed = await seed();
  const otherId = await otherWorkspace();
  await seed(otherId);
  const itemId = feed.items[0].id;
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId, saved: true });
  await setItemSaved({ workspaceId: otherId, itemId, saved: true });

  // Act
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId, saved: false });
  await pruneExpiredItems(15);

  // Assert
  expect((await querySavedPage({ workspaceId: otherId, limit: 50 })).rows).toHaveLength(1);
  expect((await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50 })).rows).toHaveLength(0);
});

test('workspace deletion removes its saved items and preserves other saves', async () => {
  // Arrange
  const otherId = await otherWorkspace();
  const feed = await seed(otherId);
  await seed();
  const itemId = feed.items[0].id;
  await setItemSaved({ workspaceId: otherId, itemId, saved: true });
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId, saved: true });
  await deleteFeedFromDatabase(feed.id, otherId);
  await deleteFeedFromDatabase(feed.id, HOME_WORKSPACE_ID);

  // Act
  await deleteWorkspace(otherId);

  // Assert
  expect((await querySavedPage({ workspaceId: otherId, limit: 50 })).rows).toEqual([]);
  expect((await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50 })).rows).toHaveLength(1);
});

test('moving a source leaves saved items in the original workspace', async () => {
  // Arrange
  const feed = await seed();
  const otherId = await otherWorkspace();
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId: feed.items[0].id, saved: true });

  // Act
  await moveFeedToWorkspace(feed.id, HOME_WORKSPACE_ID, otherId, 'Tech');

  // Assert
  expect((await querySavedPage({ workspaceId: HOME_WORKSPACE_ID, limit: 50 })).rows).toHaveLength(1);
  expect((await querySavedPage({ workspaceId: otherId, limit: 50 })).rows).toEqual([]);
});

test('rejects items from another workspace and unknown workspaces', async () => {
  // Arrange
  const feed = await seed();
  const otherId = await otherWorkspace();

  // Act
  const foreign = await setItemSaved({ workspaceId: otherId, itemId: feed.items[0].id, saved: true });
  const missing = await setItemSaved({ workspaceId: 999999, itemId: feed.items[0].id, saved: true });

  // Assert
  expect(foreign).toMatchObject({ success: false, error: { name: 'ITEM_NOT_FOUND' } });
  expect(missing).toMatchObject({ success: false, error: { name: 'WORKSPACE_NOT_FOUND' } });
});

test('deleting a workspace collects its last detached saved item', async () => {
  // Arrange
  const workspaceId = await otherWorkspace();
  const feed = await seed(workspaceId);
  await setItemSaved({ workspaceId, itemId: feed.items[0].id, saved: true });
  await deleteFeedFromDatabase(feed.id, workspaceId);

  // Act
  await deleteWorkspace(workspaceId);

  // Assert
  expect(await db.selectFrom('savedItem').selectAll().execute()).toEqual([]);
  expect(await db.selectFrom('feedMetadata').selectAll().execute()).toEqual([]);
});

test('unsaving an expired item makes it eligible for cleanup again', async () => {
  // Arrange
  const feed = await seed();
  const itemId = feed.items[0].id;
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId, saved: true });
  await pruneExpiredItems(15);

  // Act
  await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId, saved: false });
  await pruneExpiredItems(15);

  // Assert
  expect(await db.selectFrom('feedItem').select('id').where('id', '=', itemId).execute()).toEqual([]);
});
