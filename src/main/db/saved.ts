// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { sql } from 'kysely';
import { collectUnplacedFeeds } from './crud/delete';
import { db, dbReady } from './database';
import { paginate } from './paging';
import { searchCondition } from './search';
import type { RiverPage, SavedQuery, SetSavedItemInput, UpdateSavedItemError } from '../../shared/contracts';
import { fail, ok, type Result } from '../../shared/result';
import { dbTry } from './db-try';

export async function setItemSaved(input: SetSavedItemInput, now = Date.now()): Promise<Result<void, UpdateSavedItemError>> {
  return dbTry(async () => {
    return await db.transaction().execute(async (trx): Promise<Result<void, UpdateSavedItemError>> => {
      const workspace = await trx.selectFrom('workspace').select('id').where('id', '=', input.workspaceId).executeTakeFirst();
      if (!workspace) {
        return fail('WORKSPACE_NOT_FOUND', 'The workspace could not be found.');
      }
      if (input.saved) {
        const item = await trx.selectFrom('feedItem').select('id').where('id', '=', input.itemId)
          .where((eb) => eb.or([
            eb.exists(eb.selectFrom('feedPlacement').select('feed_id').whereRef('feedPlacement.feed_id', '=', 'feedItem.feed_id').where('workspace_id', '=', input.workspaceId)),
            eb.exists(eb.selectFrom('savedItem').select('item_id').whereRef('savedItem.item_id', '=', 'feedItem.id').where('workspace_id', '=', input.workspaceId)),
          ])).executeTakeFirst();
        if (!item) {
          return fail('ITEM_NOT_FOUND', 'The item could not be found in this workspace.');
        }
        await trx.insertInto('savedItem')
          .values({ workspace_id: input.workspaceId, item_id: input.itemId, saved_at: now })
          .onConflict((oc) => oc.columns(['workspace_id', 'item_id']).doNothing()).execute();
      } else {
        await trx.deleteFrom('savedItem').where('workspace_id', '=', input.workspaceId).where('item_id', '=', input.itemId).execute();
        await collectUnplacedFeeds(trx);
      }
      return ok();
    });
  }, { fallback: 'The item could not be saved.' });
}

export async function querySavedPage(query: SavedQuery): Promise<RiverPage> {
  await dbReady;
  let builder = db.selectFrom('savedItem as s')
    .innerJoin('feedItem as i', 'i.id', 's.item_id')
    .innerJoin('feedMetadata as f', 'f.id', 'i.feed_id')
    .leftJoin('feedPlacement as p', (join) => join.onRef('p.feed_id', '=', 'f.id').onRef('p.workspace_id', '=', 's.workspace_id'))
    .leftJoin('feedCategory as c', 'c.id', 'p.category_id')
    .where('s.workspace_id', '=', query.workspaceId)
    .select([
      'i.id as id', 'i.title as title', 'i.link as link', 'i.published_at as publishedAt',
      'i.excerpt as excerpt', 'i.image as image', 'i.read_at as readAt',
      'f.id as feedId', 'f.title as feedTitle', 'f.link as feedLink', 'f.icon as feedIcon', 'f.type as type',
      's.saved_at as savedAt', sql<string>`coalesce(c.name, '')`.as('categoryName'),
    ]);
  if (query.ids) {
    builder = builder.where('i.id', 'in', query.ids);
  }
  if (query.unreadOnly) {
    builder = builder.where('i.read_at', 'is', null);
  }
  const search = searchCondition(query.search);
  if (search) {
    builder = builder.where(search);
  }
  if (query.cursor) {
    const { savedAt, id } = query.cursor;
    builder = builder.where((eb) => eb.or([
      eb('s.saved_at', '<', savedAt),
      eb.and([eb('s.saved_at', '=', savedAt), eb('i.id', '<', id)]),
    ]));
  }
  const rows = await builder.orderBy('s.saved_at', 'desc').orderBy('i.id', 'desc').limit(query.limit + 1).execute();
  const { page, last } = paginate(rows, query.limit);
  return {
    rows: page,
    ...(last ? { nextCursor: { savedAt: last.savedAt, publishedAt: last.publishedAt, id: last.id } } : {}),
  };
}
