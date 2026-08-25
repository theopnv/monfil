import { db, dbReady } from '../database';
import type { Result } from '../../../utils';

export type DeleteFeedError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'FEED_NOT_FOUND'; message: string };

/**
 * Deletes a feed and, through the `feedItem.feed_id` cascade, every one of its items.
 * @param feedId the id of the feed to delete
 */
export async function deleteFeedFromDatabase(feedId: number): Promise<Result<void, DeleteFeedError>> {
  await dbReady;
  try {
    const result = await db.deleteFrom('feedMetadata').where('id', '=', feedId).executeTakeFirst();
    if (result.numDeletedRows === 0n) {
      return { success: false, error: { name: 'FEED_NOT_FOUND', message: `No feed found with id ${feedId}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
