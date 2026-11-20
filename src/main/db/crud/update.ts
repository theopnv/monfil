// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { upsertFeedCategory, upsertFeedPlacement } from './insert';
import { db } from '../database';
import type { FeedCategory, MoveFeedError, UpdateCategoryError, UpdateFeedError, UpdateItemError, UpdateWorkspaceError, Workspace } from '../../../shared/contracts';
import type { ErrorParams } from '../../../shared/errors';
import { fail, ok, type Result } from '../../../shared/result';
import { dbTry, hasSqliteCode } from '../db-try';

class WorkspaceNotFoundError extends Error {}

/**
 * Renames a category in place. A category id that belongs to another workspace is reported as
 * missing rather than renamed, so an action taken from one workspace can never reach another's.
 * @param categoryId the id of the category to rename
 * @param name the new name, unique within the workspace
 * @param workspaceId the workspace the category belongs to
 */
export async function renameCategory(categoryId: number, name: string, workspaceId: number): Promise<Result<FeedCategory, UpdateCategoryError>> {
  return dbTry(async () => {
    const updated = await db.updateTable('feedCategory')
      .set({ name })
      .where('id', '=', categoryId)
      .where('workspace_id', '=', workspaceId)
      .returningAll()
      .executeTakeFirst();
    if (!updated) {
      return fail('CATEGORY_NOT_FOUND', `No category found with id ${categoryId}`);
    }
    return { success: true, data: updated };
  }, { mapKnown: (error) => (hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE') ? fail('DUPLICATE_NAME', `A category named "${name}" already exists.`, { name }) : undefined) });
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
    return ok();
  }

  return dbTry(async () => {
    await db.updateTable('feedPlacement')
      .set({ category_id: categoryId })
      .where('feed_id', 'in', feedIds)
      .where('workspace_id', '=', workspaceId)
      .execute();
    return ok();
  }, { mapKnown: (error) => (hasSqliteCode(error, 'SQLITE_CONSTRAINT_FOREIGNKEY') ? fail('CATEGORY_NOT_FOUND', `No category found with id ${categoryId}`) : undefined) });
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
    return ok();
  }

  return dbTry(async () => {
    const result = await db.updateTable('feedPlacement')
      .set({ showInWorkspace: showInWorkspace ? 1 : 0 })
      .where('feed_id', 'in', ids)
      .where('workspace_id', '=', workspaceId)
      .executeTakeFirst();
    if (result.numUpdatedRows !== BigInt(ids.length)) {
      return fail('FEED_NOT_FOUND', `No feed found in workspace ${workspaceId} for every id of ${ids.join(', ')}`);
    }
    return ok();
  });
}

/**
 * Records the outcome of one refresh of one feed. `last_fetched_at` moves on both paths, so a feed that
 * keeps failing is distinguishable from a feed that has published nothing. Validators left out keep
 * their stored value; a validator set to `null` is cleared, which is how a body without validators
 * retires a stale one.
 * @param feedId the id of the feed that was fetched
 * @param result the failure to record (`last_error` is the raw text, `last_error_code` and
 *   `last_error_params` let the renderer translate it), or `{ last_error: null }` to clear a previous
 *   one, plus the validators to persist
 */
export async function setFeedFetchResult(feedId: number, result: { last_error: string | null; last_error_code?: string; last_error_params?: ErrorParams; etag?: string | undefined | null; last_modified?: string | undefined | null }): Promise<Result<void, UpdateFeedError>> {
  return dbTry(async () => {
    const updated = await db.updateTable('feedMetadata')
      .set({
        last_fetched_at: new Date().toISOString(),
        last_error: result.last_error,
        last_error_code: result.last_error === null ? null : result.last_error_code ?? null,
        last_error_params: result.last_error === null || result.last_error_params === undefined ? null : JSON.stringify(result.last_error_params),
        ...(result.etag !== undefined ? { etag: result.etag } : {}),
        ...(result.last_modified !== undefined ? { last_modified: result.last_modified } : {}),
      })
      .where('id', '=', feedId)
      .executeTakeFirst();
    if (updated.numUpdatedRows === 0n) {
      return fail('FEED_NOT_FOUND', `No feed found for id ${feedId}`);
    }
    return ok();
  });
}

/**
 * Stores the icon found for a feed that had none, leaving an icon set meanwhile untouched.
 * @param feedId the id of the feed
 * @param icon the icon URL
 */
export async function setFeedIconIfMissing(feedId: number, icon: string): Promise<Result<void, UpdateFeedError>> {
  return dbTry(async () => {
    await db.updateTable('feedMetadata').set({ icon }).where('id', '=', feedId).where('icon', 'is', null).execute();
    return ok();
  });
}

/**
 * Sets `read_at` on a batch of feed items in one statement.
 * @param itemIds the ids of the items to update
 * @param read whether the items are read
 */
export async function setFeedItemsRead(itemIds: number[], read: boolean): Promise<Result<void, UpdateItemError>> {
  if (itemIds.length === 0) {
    return ok();
  }

  return dbTry(async () => {
    const result = await db.updateTable('feedItem')
      .set({ read_at: read ? new Date().toISOString() : null })
      .where('id', 'in', itemIds)
      .executeTakeFirst();
    if (result.numUpdatedRows === 0n) {
      return fail('ITEM_NOT_FOUND', `No feed item found for ids ${itemIds.join(', ')}`);
    }
    return ok();
  });
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
  return dbTry(async () => {
    const moved = await db.transaction().execute(async (trx) => {
      const source = await trx.deleteFrom('feedPlacement')
        .where('feed_id', '=', feedId)
        .where('workspace_id', '=', fromWorkspaceId)
        .returningAll()
        .executeTakeFirst();

      if (!source) {
        return false;
      }

      const category = await upsertFeedCategory(trx, categoryName, toWorkspaceId);
      await upsertFeedPlacement(trx, feedId, category.id, toWorkspaceId, source.showInWorkspace);

      return true;
    });

    if (!moved) {
      return fail('FEED_NOT_FOUND', `No feed found with id ${feedId} in workspace ${fromWorkspaceId}`);
    }
    return ok();
  });
}

/**
 * Updates a workspace's name, icon and/or colour in place.
 * @param workspaceId the id of the workspace to update
 * @param patch the fields to change; a field left out keeps its current value
 */
export async function updateWorkspace(workspaceId: number, patch: { name?: string; icon?: string; color?: string }): Promise<Result<Workspace, UpdateWorkspaceError>> {
  return dbTry(async () => {
    const updated = await db.updateTable('workspace').set(patch).where('id', '=', workspaceId).returningAll().executeTakeFirst();
    if (!updated) {
      return fail('WORKSPACE_NOT_FOUND', `No workspace found with id ${workspaceId}`);
    }
    return { success: true, data: updated };
  });
}

/**
 * Sets every workspace's `position` to its index in `orderedIds`, in one transaction.
 * @param orderedIds every workspace id, in the rail order to persist
 */
export async function reorderWorkspaces(orderedIds: number[]): Promise<Result<void, UpdateWorkspaceError>> {
  if (orderedIds.length === 0) {
    return ok();
  }

  return dbTry(async () => {
    await db.transaction().execute(async (trx) => {
      for (const [position, id] of orderedIds.entries()) {
        const result = await trx.updateTable('workspace').set({ position }).where('id', '=', id).executeTakeFirst();
        if (result.numUpdatedRows === 0n) {
          throw new WorkspaceNotFoundError(`No workspace found with id ${id}`);
        }
      }
    });
    return ok();
  }, { mapKnown: (error) => (error instanceof WorkspaceNotFoundError ? fail('WORKSPACE_NOT_FOUND', error.message) : undefined) });
}
