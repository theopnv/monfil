import { db, dbReady } from '../database';
import type { FeedCategory, MoveFeedError, UpdateCategoryError, UpdateFeedError, UpdateItemError, UpdateWorkspaceError, Workspace } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';

class WorkspaceNotFoundError extends Error {}

/**
 * Renames a category in place. A category id that belongs to another workspace is reported as
 * missing rather than renamed, so an action taken from one workspace can never reach another's.
 * @param categoryId the id of the category to rename
 * @param name the new name, unique within the workspace
 * @param workspaceId the workspace the category belongs to
 */
export async function renameCategory(categoryId: number, name: string, workspaceId: number): Promise<Result<FeedCategory, UpdateCategoryError>> {
  await dbReady;
  try {
    const updated = await db.updateTable('feedCategory')
      .set({ name })
      .where('id', '=', categoryId)
      .where('workspace_id', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      return { success: false, error: { name: 'CATEGORY_NOT_FOUND', message: `No category found with id ${categoryId}` } };
    }
    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: { name: 'DUPLICATE_NAME', message: `A category named "${name}" already exists.` } };
    }
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Moves a batch of feeds into a category in one statement, within `workspaceId`. A category owned by
 * another workspace is refused by `feedPlacement_category_workspace_fk` and reported as missing.
 * @param feedIds the ids of the feeds to move
 * @param categoryId the id of the destination category
 * @param workspaceId the workspace both the feeds and the category belong to
 */
export async function moveFeedsToCategory(feedIds: number[], categoryId: number, workspaceId: number): Promise<Result<void, UpdateCategoryError>> {
  if (feedIds.length === 0) {
    return { success: true, data: undefined };
  }

  await dbReady;
  try {
    await db.updateTable('feedPlacement')
      .set({ category_id: categoryId })
      .where('feed_id', 'in', feedIds)
      .where('workspace_id', '=', workspaceId)
      .execute();
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
      return { success: false, error: { name: 'CATEGORY_NOT_FOUND', message: `No category found with id ${categoryId}` } };
    }
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Sets `showInWorkspace` on a batch of feeds' placement in `workspaceId`, in one statement. Every id
 * has to resolve to a placement there: a partially applied batch is reported as a failure, since the
 * caller asked for all of them.
 * @param feedIds the ids of the feeds to update
 * @param showInWorkspace the value to set
 * @param workspaceId the workspace the placement belongs to
 */
export async function setFeedsShowInWorkspace(feedIds: number[], showInWorkspace: boolean, workspaceId: number): Promise<Result<void, UpdateFeedError>> {
  const ids = [...new Set(feedIds)];
  if (ids.length === 0) {
    return { success: true, data: undefined };
  }

  await dbReady;
  try {
    const result = await db.updateTable('feedPlacement')
      .set({ showInWorkspace: showInWorkspace ? 1 : 0 })
      .where('feed_id', 'in', ids)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();
    if (result.numUpdatedRows !== BigInt(ids.length)) {
      return { success: false, error: { name: 'FEED_NOT_FOUND', message: `No feed found in workspace ${workspaceId} for every id of ${ids.join(', ')}` } };
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

/**
 * Moves a feed's placement from `fromWorkspaceId` into `toWorkspaceId`, filing it under
 * `categoryName` there. That category is created first if the destination does not have it yet. The
 * source placement has to exist, otherwise this would add a placement rather than move one, and it
 * carries its `showInWorkspace` across so a hidden feed stays hidden.
 * @param feedId the id of the feed to move
 * @param fromWorkspaceId the workspace the feed currently sits in
 * @param toWorkspaceId the workspace to place it in instead
 * @param categoryName the destination category, created if missing
 */
export async function moveFeedToWorkspace(feedId: number, fromWorkspaceId: number, toWorkspaceId: number, categoryName: string): Promise<Result<void, MoveFeedError>> {
  await dbReady;
  try {
    const moved = await db.transaction().execute(async (trx) => {
      const source = await trx.deleteFrom('feedPlacement')
        .where('feed_id', '=', feedId)
        .where('workspace_id', '=', fromWorkspaceId)
        .returningAll()
        .executeTakeFirst();

      if (!source) {
        return false;
      }

      const category = await trx.insertInto('feedCategory')
        .values({ name: categoryName, workspace_id: toWorkspaceId })
        .onConflict((oc) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
        .returningAll()
        .executeTakeFirstOrThrow();

      await trx.insertInto('feedPlacement')
        .values({ feed_id: feedId, category_id: category.id, workspace_id: toWorkspaceId, showInWorkspace: source.showInWorkspace })
        .onConflict((oc) => oc.columns(['feed_id', 'workspace_id']).doUpdateSet((eb) => ({
          category_id: eb.ref('excluded.category_id'),
          showInWorkspace: eb.ref('excluded.showInWorkspace'),
        })))
        .execute();

      return true;
    });

    if (!moved) {
      return { success: false, error: { name: 'FEED_NOT_FOUND', message: `No feed found with id ${feedId} in workspace ${fromWorkspaceId}` } };
    }
    return { success: true, data: undefined };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Updates a workspace's name, icon and/or colour in place.
 * @param workspaceId the id of the workspace to update
 * @param patch the fields to change; a field left out keeps its current value
 */
export async function updateWorkspace(workspaceId: number, patch: { name?: string; icon?: string; color?: string }): Promise<Result<Workspace, UpdateWorkspaceError>> {
  await dbReady;
  try {
    const updated = await db.updateTable('workspace').set(patch).where('id', '=', workspaceId).returningAll().executeTakeFirst();
    if (!updated) {
      return { success: false, error: { name: 'WORKSPACE_NOT_FOUND', message: `No workspace found with id ${workspaceId}` } };
    }
    return { success: true, data: updated };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Sets every workspace's `position` to its index in `orderedIds`, in one transaction.
 * @param orderedIds every workspace id, in the rail order to persist
 */
export async function reorderWorkspaces(orderedIds: number[]): Promise<Result<void, UpdateWorkspaceError>> {
  if (orderedIds.length === 0) {
    return { success: true, data: undefined };
  }

  await dbReady;
  try {
    await db.transaction().execute(async (trx) => {
      for (const [position, id] of orderedIds.entries()) {
        const result = await trx.updateTable('workspace').set({ position }).where('id', '=', id).executeTakeFirst();
        if (result.numUpdatedRows === 0n) {
          throw new WorkspaceNotFoundError(`No workspace found with id ${id}`);
        }
      }
    });
    return { success: true, data: undefined };
  } catch (error) {
    if (error instanceof WorkspaceNotFoundError) {
      return { success: false, error: { name: 'WORKSPACE_NOT_FOUND', message: error.message } };
    }
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
