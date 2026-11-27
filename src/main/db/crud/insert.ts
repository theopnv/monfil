// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { type Kysely } from 'kysely';
import { logger } from '../../logging/logger';
import { db, dbReady } from '../database';
import { queryFeedItems } from './query';
import { parseErrorParams } from '../error-params';
import { type Database, type FeedItem, type NewArticleContent } from '../types';
import type { AddFeedError, CreateCategoryError, CreateWorkspaceError, FeedCategory, FeedMetadata, NewFeedInput, SourceType, Workspace } from '../../../shared/contracts';
import { fail, type Result } from '../../../shared/result';
import { stripHtml, truncateOnWordBoundary } from '../../lib/strip-html';
import { dbTry, hasSqliteCode } from '../db-try';
import { hasPublishedDate, publishedAtOrFallback } from '../dates';

const EXCERPT_MAX_LENGTH = 200;
// Undated items on a feed's first fetch are backlog, so they must not bury the news that came with them.
const FIRST_FETCH_UNDATED_AGE_MS = 7 * 86_400_000;

type IncomingItem = Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>;

async function itemDates(executor: Kysely<Database>, feedId: number, items: IncomingItem[], firstSeenAt: (guid: string) => number): Promise<Map<string, number>> {
  const undated = items.filter((item) => !hasPublishedDate(item.pubDate));
  const existing = undated.length > 0
    ? await executor.selectFrom('undatedItem').selectAll().where('feed_id', '=', feedId).where('guid', 'in', undated.map((item) => item.guid)).execute()
    : [];
  const dates = new Map(existing.map((row) => [row.guid, row.first_fetched_at]));
  const fresh = undated.filter((item) => !dates.has(item.guid));
  if (fresh.length > 0) {
    const markers = fresh.map((item) => ({ feed_id: feedId, guid: item.guid, first_fetched_at: firstSeenAt(item.guid) }));
    await executor.insertInto('undatedItem').values(markers)
      .onConflict((oc) => oc.columns(['feed_id', 'guid']).doNothing()).execute();
    for (const marker of markers) {
      dates.set(marker.guid, marker.first_fetched_at);
    }
  }
  return dates;
}

export async function upsertFeedCategory(trx: Kysely<Database>, categoryName: string, workspaceId: number) {
  return trx.insertInto('feedCategory')
    .values({ name: categoryName, workspace_id: workspaceId })
    .onConflict((oc) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Creates a new, empty category in `workspaceId`. Unlike `upsertFeedCategory`, a name
 * already in use is an error rather than a silent reuse, since this path is a deliberate "new folder"
 * action.
 */
export async function createCategory(name: string, workspaceId: number): Promise<Result<FeedCategory, CreateCategoryError>> {
  return dbTry(async () => {
    const category = await db.insertInto('feedCategory').values({ name, workspace_id: workspaceId }).returningAll().executeTakeFirstOrThrow();
    return { success: true, data: category };
  }, { mapKnown: (error) => (hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE') ? fail('DUPLICATE_NAME', `A category named "${name}" already exists.`, { name }) : undefined) });
}

/** Appended after every existing workspace in rail order. `icon` is an `@untitledui/icons` component name and `color` a hex string. */
export async function createWorkspace(name: string, icon: string, color: string): Promise<Result<Workspace, CreateWorkspaceError>> {
  return dbTry(async () => {
    const workspace = await db.transaction().execute(async (trx) => {
      const { maxPosition } = await trx.selectFrom('workspace')
        .select((eb) => eb.fn.max('position').as('maxPosition'))
        .executeTakeFirstOrThrow();
      return trx.insertInto('workspace')
        .values({ name, icon, color, position: (maxPosition ?? -1) + 1 })
        .returningAll()
        .executeTakeFirstOrThrow();
    });
    return { success: true, data: workspace };
  });
}

async function addFeedMetadataToDatabase(trx: Kysely<Database>, link: string, title: string, type: SourceType, icon: string | undefined) {
  return trx.insertInto('feedMetadata')
    .values({ link, title, type, icon })
    .onConflict((oc) => oc.column('link').doUpdateSet((eb) => ({
      title: eb.ref('excluded.title'),
      type: eb.ref('excluded.type'),
      icon: eb.ref('excluded.icon'),
    })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

export async function upsertFeedPlacement(trx: Kysely<Database>, feedId: number, categoryId: number, workspaceId: number, showInWorkspace: number) {
  return trx.insertInto('feedPlacement')
    .values({ feed_id: feedId, category_id: categoryId, workspace_id: workspaceId, showInWorkspace })
    .onConflict((oc) => oc.columns(['feed_id', 'workspace_id']).doUpdateSet((eb) => ({
      category_id: eb.ref('excluded.category_id'),
      showInWorkspace: eb.ref('excluded.showInWorkspace'),
    })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

export type AddFeedItemsError = { name: 'DB_ERROR'; message: string };

async function insertFeedItems(executor: Kysely<Database>, feedId: number, items: IncomingItem[], dates?: Map<string, number>): Promise<FeedItem[]> {
  if (items.length === 0) {
    return [];
  }
  const fetchedAt = Date.now();
  dates ??= await itemDates(executor, feedId, items, () => fetchedAt);
  return executor.insertInto('feedItem')
    .values(items.map((item) => ({
      feed_id: feedId,
      ...item,
      published_at: publishedAtOrFallback(item.pubDate, dates.get(item.guid) ?? fetchedAt),
      excerpt: truncateOnWordBoundary(stripHtml(item.description), EXCERPT_MAX_LENGTH),
    })))
    .onConflict((oc) => oc.columns(['feed_id', 'guid']).doNothing())
    .returningAll()
    .execute();
}

/** Inserts the items of one feed, skipping the guids that feed already holds. */
export async function addFeedItemsToDatabase(executor: Kysely<Database>, feedId: number, items: IncomingItem[]): Promise<Result<FeedItem[], AddFeedItemsError>> {
  try {
    const inserted = await executor.transaction().execute((trx) => insertFeedItems(trx, feedId, items));
    return { success: true, data: inserted };
  } catch (error) {
    return fail('DB_ERROR', error instanceof Error ? error.message : 'An unknown error occurred');
  }
}

async function hasItemHistory(trx: Kysely<Database>, feedId: number): Promise<boolean> {
  const item = await trx.selectFrom('feedItem').select('id').where('feed_id', '=', feedId).limit(1).executeTakeFirst();
  const marker = await trx.selectFrom('undatedItem').select('guid').where('feed_id', '=', feedId).limit(1).executeTakeFirst();
  return item !== undefined || marker !== undefined;
}

async function syncFeedItemsInTransaction(trx: Kysely<Database>, feedId: number, items: IncomingItem[], cutoff: number): Promise<{ inserted: FeedItem[]; updated: number }> {
  if (items.length === 0) {
    return { inserted: [], updated: 0 };
  }
  const fetchedAt = Date.now();
  const oldMarkers = await trx.selectFrom('undatedItem').selectAll().where('feed_id', '=', feedId).where('guid', 'in', items.map((item) => item.guid)).execute();
  const firstFetch = !(await hasItemHistory(trx, feedId));
  const previous = await trx.selectFrom('feedItem').selectAll().where('feed_id', '=', feedId).where('guid', 'in', items.map((item) => item.guid)).execute();
  const byGuid = new Map(previous.map((item) => [item.guid, item]));
  const undatedSince = firstFetch ? fetchedAt - FIRST_FETCH_UNDATED_AGE_MS : fetchedAt;
  const markerByGuid = await itemDates(trx, feedId, items, (guid) => byGuid.get(guid)?.published_at ?? undatedSince);
  const tombstones = new Set(oldMarkers.map((row) => row.guid));
  const newestStored = await trx.selectFrom('feedItem').select(['guid', 'published_at'])
    .where('feed_id', '=', feedId).orderBy('published_at', 'desc').orderBy('id', 'desc').limit(10).execute();
  const rank = new Map(newestStored.map((row) => [row.guid, row.published_at]));
  for (const item of items) {
    rank.set(item.guid, publishedAtOrFallback(item.pubDate, markerByGuid.get(item.guid) ?? fetchedAt));
  }
  const protectedGuids = new Set([...rank].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([guid]) => guid));
  const fresh = items.filter((item) => {
    // Stryker disable next-line BlockStatement: a guid that is already stored reaches the insert's onConflict doNothing, which skips it the same way
    if (byGuid.has(item.guid)) {
      // Stryker disable next-line BooleanLiteral: same reason, a stored guid is skipped by the insert whatever this returns
      return false;
    }
    const date = publishedAtOrFallback(item.pubDate, markerByGuid.get(item.guid) ?? fetchedAt);
    if (tombstones.has(item.guid) && date < cutoff && !hasPublishedDate(item.pubDate)) {
      return false;
    }
    return date >= cutoff || protectedGuids.has(item.guid);
  });
  const added = await insertFeedItems(trx, feedId, fresh, markerByGuid);
  let updated = 0;
  for (const item of items) {
    const old = byGuid.get(item.guid);
    if (!old) {
      continue;
    }
    const patch = {
      title: item.title, link: item.link, pubDate: item.pubDate, description: item.description,
      image: item.image, author: item.author, extra: item.extra,
      published_at: publishedAtOrFallback(item.pubDate, markerByGuid.get(item.guid) ?? old.published_at),
      excerpt: truncateOnWordBoundary(stripHtml(item.description), EXCERPT_MAX_LENGTH),
    };
    if ((Object.keys(patch) as (keyof typeof patch)[]).every((key) => (old[key] ?? undefined) === (patch[key] ?? undefined))) {
      continue;
    }
    if (old.link !== item.link || old.description !== item.description) {
      await trx.deleteFrom('articleContent').where('item_id', '=', old.id).execute();
    }
    await trx.updateTable('feedItem').set(patch).where('id', '=', old.id).execute();
    updated++;
  }
  const corrected = items.filter((item) => hasPublishedDate(item.pubDate));
  if (corrected.length > 0) {
    await trx.deleteFrom('undatedItem').where('feed_id', '=', feedId).where('guid', 'in', corrected.map((item) => item.guid)).execute();
  }
  return { inserted: added, updated };
}

export async function syncFeedItemsToDatabase(executor: Kysely<Database>, feedId: number, items: IncomingItem[], cutoff = Number.NEGATIVE_INFINITY): Promise<Result<{ inserted: FeedItem[]; updated: number }, AddFeedItemsError>> {
  try {
    const data = await executor.transaction().execute((trx) => syncFeedItemsInTransaction(trx, feedId, items, cutoff));
    return { success: true, data };
  } catch (error) {
    return fail('DB_ERROR', error instanceof Error ? error.message : String(error));
  }
}

/** The full row set a freshly added feed needs internally (e.g. to enrich its items). Never sent over IPC as-is. */
export type AddedFeed = FeedMetadata & { items: FeedItem[]; category: FeedCategory; showInWorkspace: number; workspaceId: number; otherWorkspaceCount: number };

export async function updateFeedItemImage(itemId: number, image: string): Promise<void> {
  await dbReady;
  try {
    await db.updateTable('feedItem').set({ image }).where('id', '=', itemId).execute();
  } catch (error) {
    logger.error('operation.failure', { operation: 'persist-image', entityId: itemId }, error);
  }
}

/**
 * Inserts or replaces the extracted article content for one feed item.
 * Fire-and-forget: extraction runs off the enrichment path, so a write failure is logged rather than surfaced.
 * @param content the row to write, including the item id it belongs to
 */
export async function upsertArticleContent(content: NewArticleContent): Promise<void> {
  await dbReady;
  try {
    await db.insertInto('articleContent')
      .values(content)
      .onConflict((oc) => oc.column('item_id').doUpdateSet((eb) => ({
        html: eb.ref('excluded.html'),
        text: eb.ref('excluded.text'),
        word_count: eb.ref('excluded.word_count'),
        status: eb.ref('excluded.status'),
        attempted_at: eb.ref('excluded.attempted_at'),
      })))
      .execute();
  } catch (error) {
    logger.error('operation.failure', { operation: 'persist-article', entityId: content.item_id }, error);
  }
}

export async function addFeedToDatabase(input: NewFeedInput, cutoff = Number.NEGATIVE_INFINITY): Promise<Result<AddedFeed, AddFeedError>> {
  return dbTry(async () => {
    const { category, metadata, placement, otherWorkspaceCount } = await db.transaction().execute(async (trx) => {
      const category = await upsertFeedCategory(trx, input.categoryName, input.workspaceId);
      const metadata = await addFeedMetadataToDatabase(trx, input.link, input.title, input.type, input.icon);
      const placement = await upsertFeedPlacement(trx, metadata.id, category.id, input.workspaceId, input.showInWorkspace ? 1 : 0);
      await syncFeedItemsInTransaction(trx, metadata.id, input.items, cutoff);
      const { count: otherWorkspaceCount } = await trx.selectFrom('feedPlacement')
        .select((eb) => eb.fn.countAll<number>().as('count'))
        .where('feed_id', '=', metadata.id)
        .where('workspace_id', '!=', input.workspaceId)
        .executeTakeFirstOrThrow();
      return { category, metadata, placement, otherWorkspaceCount };
    });

    const items = await queryFeedItems({ feed_id: metadata.id });
    return {
      success: true,
      data: {
        id: metadata.id,
        link: metadata.link,
        title: metadata.title,
        type: metadata.type,
        last_fetched_at: metadata.last_fetched_at,
        last_error: metadata.last_error,
        last_error_code: metadata.last_error_code,
        last_error_params: parseErrorParams(metadata.last_error_params),
        icon: metadata.icon,
        items,
        category,
        showInWorkspace: placement.showInWorkspace,
        workspaceId: placement.workspace_id,
        otherWorkspaceCount,
      },
    };
  });
}
