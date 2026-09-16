import { db, dbReady } from '../database';
import type { Result } from '../../lib/utils';
import { HOME_WORKSPACE_ID } from '../types';

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
      await trx.updateTable('feedPlacement').set({ category_id: reassignTo }).where('category_id', '=', categoryId).execute();
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

export type DeleteWorkspaceError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'WORKSPACE_NOT_FOUND'; message: string }
  | { name: 'HOME_NOT_DELETABLE'; message: string };

/**
 * Deletes a workspace along with its categories and placements, then collects any feed left with
 * zero placements anywhere (through every other workspace's placements too). Home can never be
 * deleted.
 * @param workspaceId the id of the workspace to delete
 */
export async function deleteWorkspace(workspaceId: number): Promise<Result<void, DeleteWorkspaceError>> {
  if (workspaceId === HOME_WORKSPACE_ID) {
    return { success: false, error: { name: 'HOME_NOT_DELETABLE', message: 'The Home workspace cannot be deleted.' } };
  }

  await dbReady;
  try {
    const result = await db.transaction().execute(async (trx) => {
      const placements = await trx.selectFrom('feedPlacement').select('feed_id').where('workspace_id', '=', workspaceId).execute();

      await trx.deleteFrom('feedPlacement').where('workspace_id', '=', workspaceId).execute();
      await trx.deleteFrom('feedCategory').where('workspace_id', '=', workspaceId).execute();

      const feedIds = placements.map((row) => row.feed_id);
      if (feedIds.length > 0) {
        await trx.deleteFrom('feedMetadata')
          .where('id', 'in', feedIds)
          .where((eb) => eb.not(eb.exists(
            eb.selectFrom('feedPlacement').select('feed_id').whereRef('feedPlacement.feed_id', '=', 'feedMetadata.id'),
          )))
          .execute();
      }

      return trx.deleteFrom('workspace').where('id', '=', workspaceId).executeTakeFirst();
    });

    if (result.numDeletedRows === 0n) {
      return { success: false, error: { name: 'WORKSPACE_NOT_FOUND', message: `No workspace found with id ${workspaceId}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
