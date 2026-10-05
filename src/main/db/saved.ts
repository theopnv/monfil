// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { sql, type Kysely } from 'kysely';
import { db, dbReady } from './database';
import type { Database } from './types';
import type { RiverPage, SavedQuery, SetSavedItemInput, UpdateSavedItemError } from '../../shared/contracts';
import type { Result } from '../../shared/result';

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

export async function setItemSaved(input: SetSavedItemInput, now = Date.now()): Promise<Result<void, UpdateSavedItemError>> {
  await dbReady;
  try {
    return await db.transaction().execute(async (trx): Promise<Result<void, UpdateSavedItemError>> => {
      const workspace = await trx.selectFrom('workspace').select('id').where('id', '=', input.workspaceId).executeTakeFirst();
      if (!workspace) {
        return { success: false, error: { name: 'WORKSPACE_NOT_FOUND', message: 'The workspace could not be found.' } };
      }
      if (input.saved) {
        const item = await trx.selectFrom('feedItem').select('id').where('id', '=', input.itemId)
          .where((eb) => eb.or([
            eb.exists(eb.selectFrom('feedPlacement').select('feed_id').whereRef('feedPlacement.feed_id', '=', 'feedItem.feed_id').where('workspace_id', '=', input.workspaceId)),
            eb.exists(eb.selectFrom('savedItem').select('item_id').whereRef('savedItem.item_id', '=', 'feedItem.id').where('workspace_id', '=', input.workspaceId)),
          ])).executeTakeFirst();
        if (!item) {
          return { success: false, error: { name: 'ITEM_NOT_FOUND', message: 'The item could not be found in this workspace.' } };
        }
        await trx.insertInto('savedItem')
          .values({ workspace_id: input.workspaceId, item_id: input.itemId, saved_at: now })
          .onConflict((oc) => oc.columns(['workspace_id', 'item_id']).doNothing()).execute();
      } else {
        await trx.deleteFrom('savedItem').where('workspace_id', '=', input.workspaceId).where('item_id', '=', input.itemId).execute();
        await collectUnplacedFeeds(trx);
      }
      return { success: true, data: undefined };
    });
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'The item could not be saved.' } };
  }
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
  for (const word of query.search?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? []) {
    const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`;
    builder = builder.where((eb) => eb.or([
      sql<boolean>`${eb.ref('i.title')} like ${pattern} escape '\\'`,
      sql<boolean>`${eb.ref('i.excerpt')} like ${pattern} escape '\\'`,
      sql<boolean>`${eb.ref('f.title')} like ${pattern} escape '\\'`,
    ]));
  }
  if (query.cursor) {
    const { savedAt, id } = query.cursor;
    builder = builder.where((eb) => eb.or([
      eb('s.saved_at', '<', savedAt),
      eb.and([eb('s.saved_at', '=', savedAt), eb('i.id', '<', id)]),
    ]));
  }
  const rows = await builder.orderBy('s.saved_at', 'desc').orderBy('i.id', 'desc').limit(query.limit + 1).execute();
  const hasMore = rows.length > query.limit;
  const page = hasMore ? rows.slice(0, query.limit) : rows;
  const last = page[page.length - 1];
  return {
    rows: page,
    ...(hasMore && last ? { nextCursor: { savedAt: last.savedAt, publishedAt: last.publishedAt, id: last.id } } : {}),
  };
}
