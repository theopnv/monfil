import { db, dbReady } from '../database';
import type { Result } from '../../lib/utils';

export type UpdateFeedError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'FEED_NOT_FOUND'; message: string };

export type UpdateItemError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'ITEM_NOT_FOUND'; message: string };

/**
 * Sets `showInHome` on a batch of feeds in one statement.
 * @param feedIds the ids of the feeds to update
 * @param showInHome the value to set
 */
export async function setFeedsShowInHome(feedIds: number[], showInHome: boolean): Promise<Result<void, UpdateFeedError>> {
  if (feedIds.length === 0) {
    return { success: true, data: undefined };
  }

  await dbReady;
  try {
    const result = await db.updateTable('feedMetadata')
      .set({ showInHome: showInHome ? 1 : 0 })
      .where('id', 'in', feedIds)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      return { success: false, error: { name: 'FEED_NOT_FOUND', message: `No feed found for ids ${feedIds.join(', ')}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Records the outcome of one refresh of one feed. `last_fetched_at` moves on both paths, so a feed that
 * keeps failing is distinguishable from a feed that has published nothing.
 * @param feedId the id of the feed that was fetched
 * @param result the failure to record, or `{ last_error: null }` to clear a previous one
 */
export async function setFeedFetchResult(feedId: number, result: { last_error: string | null }): Promise<Result<void, UpdateFeedError>> {
  await dbReady;
  try {
    const updated = await db.updateTable('feedMetadata')
      .set({ last_fetched_at: new Date().toISOString(), last_error: result.last_error })
      .where('id', '=', feedId)
      .executeTakeFirst();
    if (updated.numUpdatedRows === 0n) {
      return { success: false, error: { name: 'FEED_NOT_FOUND', message: `No feed found for id ${feedId}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Sets `read_at` on a batch of feed items in one statement.
 * @param itemIds the ids of the items to update
 * @param read whether the items are read
 */
export async function setFeedItemsRead(itemIds: number[], read: boolean): Promise<Result<void, UpdateItemError>> {
  if (itemIds.length === 0) {
    return { success: true, data: undefined };
  }

  await dbReady;
  try {
    const result = await db.updateTable('feedItem')
      .set({ read_at: read ? new Date().toISOString() : null })
      .where('id', 'in', itemIds)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      return { success: false, error: { name: 'ITEM_NOT_FOUND', message: `No feed item found for ids ${itemIds.join(', ')}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
