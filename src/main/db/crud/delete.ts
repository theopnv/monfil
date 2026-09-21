import { db, dbReady } from '../database';
import { HOME_WORKSPACE_ID, type DeleteCategoryError, type DeleteFeedError, type DeleteWorkspaceError } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';

/**
 * Removes a feed from `workspaceId`. The underlying feed, and through the `feedItem.feed_id`
 * cascade every one of its items, is only deleted once no workspace places it anymore.
 * @param feedId the id of the feed to remove
 * @param workspaceId the workspace to remove it from
 */
export async function deleteFeedFromDatabase(feedId: number, workspaceId: number): Promise<Result<void, DeleteFeedError>> {
  await dbReady;
  try {
    const deleted = await db.transaction().execute(async (trx) => {
      const deleted = await trx.deleteFrom('feedPlacement')
        .where('feed_id', '=', feedId)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();

      if (deleted.numDeletedRows > 0n) {
        await trx.deleteFrom('feedMetadata')
          .where('id', '=', feedId)
          .where((eb) => eb.not(eb.exists(
            eb.selectFrom('feedPlacement').select('feed_id').whereRef('feedPlacement.feed_id', '=', 'feedMetadata.id'),
          )))
          .execute();
      }

      return deleted;
    });

    if (deleted.numDeletedRows === 0n) {
      return { success: false, error: { name: 'FEED_NOT_FOUND', message: `No feed found with id ${feedId} in workspace ${workspaceId}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

class CategoryNotFoundError extends Error {}

/**
 * Deletes a category, first moving every feed it holds into `reassignTo`. A category cannot vanish
 * silently while feeds still point at it, so the caller must name an explicit destination. Both
 * categories have to belong to `workspaceId`: reassigning into another workspace's folder would put
 * the feed in a folder its own sidebar never lists.
 * @param categoryId the id of the category to delete
 * @param reassignTo the id of the category its feeds move into first
 * @param workspaceId the workspace both categories belong to
 */
export async function deleteCategory(categoryId: number, reassignTo: number, workspaceId: number): Promise<Result<void, DeleteCategoryError>> {
  await dbReady;
  try {
    const result = await db.transaction().execute(async (trx) => {
      const destination = await trx.selectFrom('feedCategory')
        .select('id')
        .where('id', '=', reassignTo)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();

      if (!destination) {
        throw new CategoryNotFoundError(`No category found with id ${reassignTo} in workspace ${workspaceId}`);
      }

      await trx.updateTable('feedPlacement')
        .set({ category_id: reassignTo })
        .where('category_id', '=', categoryId)
        .where('workspace_id', '=', workspaceId)
        .execute();

      return trx.deleteFrom('feedCategory')
        .where('id', '=', categoryId)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();
    });
    if (result.numDeletedRows === 0n) {
      return { success: false, error: { name: 'CATEGORY_NOT_FOUND', message: `No category found with id ${categoryId} in workspace ${workspaceId}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof CategoryNotFoundError) {
      return { success: false, error: { name: 'CATEGORY_NOT_FOUND', message: error.message } };
    }
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

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
