// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Kysely } from 'kysely';
import { db } from '../database';
import type { Database } from '../types';
import { HOME_WORKSPACE_ID, type DeleteCategoryError, type DeleteFeedError, type DeleteWorkspaceError } from '../../../shared/contracts';
import { fail, ok, type Result } from '../../../shared/result';
import { dbTry } from '../db-try';

/** Deletes the feeds that no workspace holds any more, and their items unless the item is saved. */
export async function collectUnplacedFeeds(executor: Kysely<Database>): Promise<void> {
  await executor.deleteFrom('feedItem')
    .where('feed_id', 'in', executor.selectFrom('feedMetadata').select('id')
      .where((eb) => eb.not(eb.exists(eb.selectFrom('feedPlacement').select('feed_id').whereRef('feedPlacement.feed_id', '=', 'feedMetadata.id')))))
    .where((eb) => eb.not(eb.exists(eb.selectFrom('savedItem').select('item_id').whereRef('savedItem.item_id', '=', 'feedItem.id'))))
    .execute();
  await executor.deleteFrom('feedMetadata')
    .where((eb) => eb.not(eb.exists(eb.selectFrom('feedPlacement').select('feed_id').whereRef('feedPlacement.feed_id', '=', 'feedMetadata.id'))))
    .where((eb) => eb.not(eb.exists(eb.selectFrom('feedItem').select('id').whereRef('feedItem.feed_id', '=', 'feedMetadata.id'))))
    .execute();
}

/**
 * Removes a feed from `workspaceId`. The underlying feed, and through the `feedItem.feed_id`
 * cascade its unsaved items, is deleted once it has neither placements nor saved items.
 */
export async function deleteFeedFromDatabase(feedId: number, workspaceId: number): Promise<Result<void, DeleteFeedError>> {
  return dbTry(async () => {
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
      return fail('FEED_NOT_FOUND', `No feed found with id ${feedId} in workspace ${workspaceId}`);
    }
    return ok();
  });
}

class CategoryNotFoundError extends Error {}

/**
 * Deletes a category together with its feeds, or first moves them into `reassignTo` when given.
 * Both categories have to belong to `workspaceId`: reassigning into another workspace's folder
 * would put the feed in a folder its own sidebar never lists. Deleted feeds follow the same
 * collection rule as `deleteFeedFromDatabase`.
 */
export async function deleteCategory(categoryId: number, workspaceId: number, reassignTo?: number): Promise<Result<void, DeleteCategoryError>> {
  return dbTry(async () => {
    const result = await db.transaction().execute(async (trx) => {
      if (reassignTo === undefined) {
        await trx.deleteFrom('feedPlacement')
          .where('category_id', '=', categoryId)
          .where('workspace_id', '=', workspaceId)
          .execute();
        await collectUnplacedFeeds(trx);
      } else {
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
      }

      return trx.deleteFrom('feedCategory')
        .where('id', '=', categoryId)
        .where('workspace_id', '=', workspaceId)
        .executeTakeFirst();
    });
    if (result.numDeletedRows === 0n) {
      return fail('CATEGORY_NOT_FOUND', `No category found with id ${categoryId} in workspace ${workspaceId}`);
    }
    return ok();
  }, { mapKnown: (error) => (error instanceof CategoryNotFoundError ? fail('CATEGORY_NOT_FOUND', error.message) : undefined) });
}

/**
 * Deletes a workspace with its saved items, categories, and placements. Feeds retained by another
 * workspace's placements or saved items survive. Home can never be deleted.
 */
export async function deleteWorkspace(workspaceId: number): Promise<Result<void, DeleteWorkspaceError>> {
  if (workspaceId === HOME_WORKSPACE_ID) {
    return fail('HOME_NOT_DELETABLE', 'The Home workspace cannot be deleted.');
  }

  return dbTry(async () => {
    const result = await db.transaction().execute(async (trx) => {
      await trx.deleteFrom('savedItem').where('workspace_id', '=', workspaceId).execute();
      await trx.deleteFrom('feedPlacement').where('workspace_id', '=', workspaceId).execute();
      await trx.deleteFrom('feedCategory').where('workspace_id', '=', workspaceId).execute();
      await collectUnplacedFeeds(trx);

      return trx.deleteFrom('workspace').where('id', '=', workspaceId).executeTakeFirst();
    });

    if (result.numDeletedRows === 0n) {
      return fail('WORKSPACE_NOT_FOUND', `No workspace found with id ${workspaceId}`);
    }
    return ok();
  });
}
