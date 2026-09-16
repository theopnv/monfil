import { db, dbReady } from '../database';
import type { Result } from '../../lib/utils';

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

export type DeleteCategoryError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'CATEGORY_NOT_FOUND'; message: string };

/**
 * Deletes a category, first moving every feed it holds into `reassignTo`. A category cannot vanish
 * silently while feeds still point at it, so the caller must name an explicit destination.
 * @param categoryId the id of the category to delete
 * @param reassignTo the id of the category its feeds move into first
 */
export async function deleteCategory(categoryId: number, reassignTo: number): Promise<Result<void, DeleteCategoryError>> {
  await dbReady;
  try {
    const result = await db.transaction().execute(async (trx) => {
      await trx.updateTable('feedMetadata').set({ category_id: reassignTo }).where('category_id', '=', categoryId).execute();
      return trx.deleteFrom('feedCategory').where('id', '=', categoryId).executeTakeFirst();
    });
    if (result.numDeletedRows === 0n) {
      return { success: false, error: { name: 'CATEGORY_NOT_FOUND', message: `No category found with id ${categoryId}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
