// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { HOME_WORKSPACE_ID } from '../../../shared/contracts';
import { db } from '../database';
import { moveFeedsToCategory, moveFeedToWorkspace, renameCategory, reorderWorkspaces, setFeedFetchResult, setFeedItemsRead, setFeedsShowInWorkspace } from './update';
import { addFeedToDatabase, createCategory, createWorkspace } from './insert';
import { useTestDatabase } from '../../test/db';
import { makeFeedInput, makeItem } from '../../test/fixtures';

const feedA = makeFeedInput();
const feedB = makeFeedInput({ link: 'https://b.example/feed', title: 'Feed B' });
const feedWithItems = makeFeedInput({
  link: 'https://c.example/feed',
  title: 'Feed C',
  items: [
    makeItem({ title: 'Item 1', link: 'https://c.example/1' }),
    makeItem({ title: 'Item 2', link: 'https://c.example/2', pubDate: '2024-01-02' }),
  ],
});

useTestDatabase();

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
});

describe('moveFeedsToCategory', () => {

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

  test('a destination the database refuses for another reason is a DB_ERROR, not a missing category', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await moveFeedsToCategory([inserted.data.id], null as unknown as number, HOME_WORKSPACE_ID);

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('DB_ERROR');
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

describe('setFeedFetchResult', () => {
  async function storedFeed(feedId: number) {
    return db.selectFrom('feedMetadata').select(['last_error', 'last_fetched_at', 'etag', 'last_modified']).where('id', '=', feedId).executeTakeFirstOrThrow();
  }

  afterEach(() => {
    vi.useRealTimers();
  });

  test('records the error and the time of the fetch', async () => {
    // Arrange
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-05-06T07:08:09.000Z'));
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }

    // Act
    const result = await setFeedFetchResult(inserted.data.id, { last_error: 'HTTP 500' });

    // Assert
    expect(result.success).toBe(true);
    expect(await storedFeed(inserted.data.id)).toMatchObject({ last_error: 'HTTP 500', last_fetched_at: '2026-05-06T07:08:09.000Z' });
  });

  test('records the error code and params next to the raw text, and clears all three on success', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    const stored = () => db.selectFrom('feedMetadata').select(['last_error', 'last_error_code', 'last_error_params']).where('id', '=', inserted.data.id).executeTakeFirstOrThrow();

    // Act
    await setFeedFetchResult(inserted.data.id, { last_error: 'HTTP 503', last_error_code: 'GENERIC_FETCH_ERROR', last_error_params: { reason: 'serverError', status: 503 } });
    const failed = await stored();
    await setFeedFetchResult(inserted.data.id, { last_error: 'offline', last_error_code: 'NETWORK_ERROR' });
    const withoutParams = await stored();
    await setFeedFetchResult(inserted.data.id, { last_error: null });
    const cleared = await stored();

    // Assert
    expect(failed).toEqual({ last_error: 'HTTP 503', last_error_code: 'GENERIC_FETCH_ERROR', last_error_params: '{"reason":"serverError","status":503}' });
    expect(withoutParams).toEqual({ last_error: 'offline', last_error_code: 'NETWORK_ERROR', last_error_params: null });
    expect(cleared).toEqual({ last_error: null, last_error_code: null, last_error_params: null });
  });

  test('keeps stored validators that the result leaves out and clears those set to null', async () => {
    // Arrange
    const inserted = await addFeedToDatabase(feedA);
    if (!inserted.success) {
      throw new Error('expected the feed to be created');
    }
    await setFeedFetchResult(inserted.data.id, { last_error: null, etag: '"v1"', last_modified: 'Mon, 01 Jan 2024 00:00:00 GMT' });

    // Act
    await setFeedFetchResult(inserted.data.id, { last_error: null });
    const kept = await storedFeed(inserted.data.id);
    await setFeedFetchResult(inserted.data.id, { last_error: null, etag: null, last_modified: null });
    const cleared = await storedFeed(inserted.data.id);

    // Assert
    expect(kept).toMatchObject({ etag: '"v1"', last_modified: 'Mon, 01 Jan 2024 00:00:00 GMT' });
    expect(cleared).toMatchObject({ etag: null, last_modified: null });
  });

  test('an unknown feed id returns FEED_NOT_FOUND', async () => {
    // Act
    const result = await setFeedFetchResult(999999, { last_error: null });

    // Assert
    expect(result.success).toBe(false);
    if (result.success) {
      return;
    }
    expect(result.error.name).toBe('FEED_NOT_FOUND');
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
});

describe('moveFeedToWorkspace', () => {

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
