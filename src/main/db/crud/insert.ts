import { type Kysely } from 'kysely';
import { logger } from '../../logging/logger';
import { db, dbReady } from '../database';
import { queryFeedItems } from './query';
import { type Database, type FeedItem, type NewArticleContent } from '../types';
import type { AddFeedError, CreateCategoryError, CreateWorkspaceError, FeedCategory, FeedMetadata, NewFeedInput, SourceType, Workspace } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';
import { stripHtml, truncateOnWordBoundary } from '../../lib/strip-html';

const EXCERPT_MAX_LENGTH = 200;

// SQLite cannot parse RFC-822 pubDates, so this must run in JS rather than in SQL.
function parsePublishedAt(pubDate: string, fetchedAt: number): number {
  const timestamp = new Date(pubDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : fetchedAt;
}

type IncomingItem = Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>;

async function itemDates(executor: Kysely<Database>, feedId: number, items: IncomingItem[], fetchedAt: number): Promise<Map<string, number>> {
  const undated = items.filter((item) => !Number.isFinite(new Date(item.pubDate).getTime()));
  const existing = undated.length > 0
    ? await executor.selectFrom('undatedItem').selectAll().where('feed_id', '=', feedId).where('guid', 'in', undated.map((item) => item.guid)).execute()
    : [];
  const dates = new Map(existing.map((row) => [row.guid, row.first_fetched_at]));
  const fresh = undated.filter((item) => !dates.has(item.guid));
  if (fresh.length > 0) {
    await executor.insertInto('undatedItem').values(fresh.map((item) => ({ feed_id: feedId, guid: item.guid, first_fetched_at: fetchedAt })))
      .onConflict((oc) => oc.columns(['feed_id', 'guid']).doNothing()).execute();
    for (const item of fresh) {
      dates.set(item.guid, fetchedAt);
    }
  }
  return dates;
}

async function addFeedCategoryToDatabase(trx: Kysely<Database>, categoryName: string, workspaceId: number) {
  return trx.insertInto('feedCategory')
    .values({ name: categoryName, workspace_id: workspaceId })
    .onConflict((oc) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Creates a new, empty category in `workspaceId`. Unlike `addFeedCategoryToDatabase`, a name
 * already in use is an error rather than a silent reuse, since this path is a deliberate "new folder"
 * action.
 * @param name the category's display name, unique within the workspace
 * @param workspaceId the workspace the category is created in
 */
export async function createCategory(name: string, workspaceId: number): Promise<Result<FeedCategory, CreateCategoryError>> {
  await dbReady;
  try {
    const category = await db.insertInto('feedCategory').values({ name, workspace_id: workspaceId }).returningAll().executeTakeFirstOrThrow();
    return { success: true, data: category };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: { name: 'DUPLICATE_NAME', message: `A category named "${name}" already exists.` } };
    }
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

/**
 * Creates a new workspace, appended after every existing one in rail order.
 * @param name the workspace's display name
 * @param icon an `@untitledui/icons` component name, as rendered by the rail
 * @param color a hex color for the rail button's tinted background
 */
export async function createWorkspace(name: string, icon: string, color: string): Promise<Result<Workspace, CreateWorkspaceError>> {
  await dbReady;
  try {
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
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
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

async function addFeedPlacementToDatabase(trx: Kysely<Database>, feedId: number, categoryId: number, workspaceId: number, showInWorkspace: boolean) {
  return trx.insertInto('feedPlacement')
    .values({ feed_id: feedId, category_id: categoryId, workspace_id: workspaceId, showInWorkspace: showInWorkspace ? 1 : 0 })
    .onConflict((oc) => oc.columns(['feed_id', 'workspace_id']).doUpdateSet((eb) => ({
      category_id: eb.ref('excluded.category_id'),
      showInWorkspace: eb.ref('excluded.showInWorkspace'),
    })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

export type AddFeedItemsError = { name: 'DB_ERROR'; message: string };

async function insertFeedItems(executor: Kysely<Database>, feedId: number, items: IncomingItem[]): Promise<FeedItem[]> {
  if (items.length === 0) {
    return [];
  }
  const fetchedAt = Date.now();
  const dates = await itemDates(executor, feedId, items, fetchedAt);
  return executor.insertInto('feedItem')
    .values(items.map((item) => ({
      feed_id: feedId,
      ...item,
      published_at: parsePublishedAt(item.pubDate, dates.get(item.guid) ?? fetchedAt),
      excerpt: truncateOnWordBoundary(stripHtml(item.description), EXCERPT_MAX_LENGTH),
    })))
    .onConflict((oc) => oc.columns(['feed_id', 'guid']).doNothing())
    .returningAll()
    .execute();
}

/**
 * Inserts the items of one feed, skipping the guids that feed already holds.
 * @param executor the database connection
 * @param feedId the feed that owns the items
 * @param items the items to insert
 * @returns the inserted rows
 */
export async function addFeedItemsToDatabase(executor: Kysely<Database>, feedId: number, items: IncomingItem[]): Promise<Result<FeedItem[], AddFeedItemsError>> {
  try {
    const inserted = await executor.transaction().execute((trx) => insertFeedItems(trx, feedId, items));
    return { success: true, data: inserted };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

async function syncFeedItemsInTransaction(trx: Kysely<Database>, feedId: number, items: IncomingItem[], cutoff: number): Promise<{ inserted: FeedItem[]; updated: number }> {
  if (items.length === 0) {
    return { inserted: [], updated: 0 };
  }
  const fetchedAt = Date.now();
  const oldMarkers = await trx.selectFrom('undatedItem').selectAll().where('feed_id', '=', feedId).where('guid', 'in', items.map((item) => item.guid)).execute();
  const markerByGuid = await itemDates(trx, feedId, items, fetchedAt);
  const tombstones = new Set(oldMarkers.map((row) => row.guid));
  const previous = await trx.selectFrom('feedItem').selectAll().where('feed_id', '=', feedId).where('guid', 'in', items.map((item) => item.guid)).execute();
  const byGuid = new Map(previous.map((item) => [item.guid, item]));
  const newestStored = await trx.selectFrom('feedItem').select(['guid', 'published_at'])
    .where('feed_id', '=', feedId).orderBy('published_at', 'desc').orderBy('id', 'desc').limit(10).execute();
  const rank = new Map(newestStored.map((row) => [row.guid, row.published_at]));
  for (const item of items) {
    rank.set(item.guid, parsePublishedAt(item.pubDate, markerByGuid.get(item.guid) ?? fetchedAt));
  }
  const protectedGuids = new Set([...rank].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([guid]) => guid));
  const fresh = items.filter((item) => {
    if (byGuid.has(item.guid)) {
      return false;
    }
    const date = parsePublishedAt(item.pubDate, markerByGuid.get(item.guid) ?? fetchedAt);
    if (tombstones.has(item.guid) && date < cutoff && !Number.isFinite(new Date(item.pubDate).getTime())) {
      return false;
    }
    return date >= cutoff || protectedGuids.has(item.guid);
  });
  const added = await insertFeedItems(trx, feedId, fresh);
  let updated = 0;
  for (const item of items) {
    const old = byGuid.get(item.guid);
    if (!old) {
      continue;
    }
    const patch = {
      title: item.title, link: item.link, pubDate: item.pubDate, description: item.description,
      image: item.image, author: item.author, extra: item.extra,
      published_at: parsePublishedAt(item.pubDate, markerByGuid.get(item.guid) ?? old.published_at),
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
  const corrected = items.filter((item) => Number.isFinite(new Date(item.pubDate).getTime()));
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
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : String(error) } };
  }
}

/** The full row set a freshly added feed needs internally (e.g. to enrich its items). Never sent over IPC as-is. */
export type AddedFeed = FeedMetadata & { items: FeedItem[]; category: FeedCategory; showInWorkspace: number; workspaceId: number };

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
      })))
      .execute();
  } catch (error) {
    logger.error('operation.failure', { operation: 'persist-article', entityId: content.item_id }, error);
  }
}

export async function addFeedToDatabase(input: NewFeedInput, cutoff = Number.NEGATIVE_INFINITY): Promise<Result<AddedFeed, AddFeedError>> {
  await dbReady;
  try {
    const { category, metadata, placement } = await db.transaction().execute(async (trx) => {
      const category = await addFeedCategoryToDatabase(trx, input.categoryName, input.workspaceId);
      const metadata = await addFeedMetadataToDatabase(trx, input.link, input.title, input.type, input.icon);
      const placement = await addFeedPlacementToDatabase(trx, metadata.id, category.id, input.workspaceId, input.showInWorkspace);
      await syncFeedItemsInTransaction(trx, metadata.id, input.items, cutoff);
      return { category, metadata, placement };
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
        icon: metadata.icon,
        items,
        category,
        showInWorkspace: placement.showInWorkspace,
        workspaceId: placement.workspace_id,
      },
    };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
