import { db, dbReady } from '../database';
import type { Result } from '../../utils';

export type UpdateFeedError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'FEED_NOT_FOUND'; message: string };

/**
 * Sets `showInHome` on a batch of feeds in one statement.
 * @param feedIds the ids of the feeds to update
 * @param showInHome the value to set
 */
export async function setFeedsShowInHome(feedIds: number[], showInHome: boolean): Promise<Result<void, UpdateFeedError>> {
  if (feedIds.length === 0) return { success: true, data: undefined };

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
