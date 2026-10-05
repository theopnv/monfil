// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { db, dbReady } from '../database';
import { collectUnplacedFeeds } from '../saved';
import { HOME_WORKSPACE_ID, type DeleteCategoryError, type DeleteFeedError, type DeleteWorkspaceError } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';

/**
 * Removes a feed from `workspaceId`. The underlying feed, and through the `feedItem.feed_id`
 * cascade its unsaved items, is deleted once it has neither placements nor saved items.
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
        await collectUnplacedFeeds(trx);
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
 * Deletes a workspace with its saved items, categories, and placements. Feeds retained by another
 * workspace's placements or saved items survive. Home can never be deleted.
 * @param workspaceId the id of the workspace to delete
 */
export async function deleteWorkspace(workspaceId: number): Promise<Result<void, DeleteWorkspaceError>> {
  if (workspaceId === HOME_WORKSPACE_ID) {
    return { success: false, error: { name: 'HOME_NOT_DELETABLE', message: 'The Home workspace cannot be deleted.' } };
  }

  await dbReady;
  try {
    const result = await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('savedItem').where('workspace_id', '=', workspaceId).execute();
      await trx.deleteFrom('feedPlacement').where('workspace_id', '=', workspaceId).execute();
      await trx.deleteFrom('feedCategory').where('workspace_id', '=', workspaceId).execute();
      await collectUnplacedFeeds(trx);

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
