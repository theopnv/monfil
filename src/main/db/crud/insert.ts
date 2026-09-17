import { type Kysely } from 'kysely';
import { db, dbReady } from '../database';
import { queryFeedItems } from './query';
import { HOME_WORKSPACE_ID, type Database, type FeedCategory, type FeedItem, type FeedMetadata, type NewArticleContent, type SourceType, type Workspace } from '../types';
import type { Result } from '../../lib/utils';
import { stripHtml, truncateOnWordBoundary } from '../../lib/strip-html';

const EXCERPT_MAX_LENGTH = 200;

// SQLite cannot parse RFC-822 pubDates, so this must run in JS rather than in SQL.
function parsePublishedAt(pubDate: string): number {
  const timestamp = new Date(pubDate).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

async function addFeedCategoryToDatabase(trx: Kysely<Database>, categoryName: string, workspaceId: number) {
  return trx.insertInto('feedCategory')
    .values({ name: categoryName, workspace_id: workspaceId })
    .onConflict((oc) => oc.columns(['workspace_id', 'name']).doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

export type CreateCategoryError =
  | { name: 'DB_ERROR'; message: string }
  | { name: 'DUPLICATE_NAME'; message: string };

/**
 * Creates a new, empty category in the Home workspace. Unlike `addFeedCategoryToDatabase`, a name
 * already in use is an error rather than a silent reuse, since this path is a deliberate "new folder"
 * action.
 * @param name the category's display name, unique within Home
 */
export async function createCategory(name: string): Promise<Result<FeedCategory, CreateCategoryError>> {
  await dbReady;
  try {
    const category = await db.insertInto('feedCategory').values({ name, workspace_id: HOME_WORKSPACE_ID }).returningAll().executeTakeFirstOrThrow();
    return { success: true, data: category };
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return { success: false, error: { name: 'DUPLICATE_NAME', message: `A category named "${name}" already exists.` } };
    }
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

export type CreateWorkspaceError = { name: 'DB_ERROR'; message: string };

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

/**
 * Inserts the items of one feed, skipping the guids that feed already holds.
 * @param executor the `db` singleton, or a transaction to insert within
 * @param feedId the id of the feed the items belong to
 * @param items the items to insert
 * @returns only the rows it wrote, since `ON CONFLICT DO NOTHING ... RETURNING *` leaves out the skipped ones
 */
export async function addFeedItemsToDatabase(executor: Kysely<Database>, feedId: number, items: Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>[]): Promise<Result<FeedItem[], AddFeedItemsError>> {
  if (items.length === 0) {
    return { success: true, data: [] };
  }
  try {
    const inserted = await executor.insertInto('feedItem')
      .values(items.map((item) => ({
        feed_id: feedId,
        ...item,
        published_at: parsePublishedAt(item.pubDate),
        excerpt: truncateOnWordBoundary(stripHtml(item.description), EXCERPT_MAX_LENGTH),
      })))
      .onConflict((oc) => oc.columns(['feed_id', 'guid']).doNothing())
      .returningAll()
      .execute();
    return { success: true, data: inserted };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}

export interface NewFeedInput {
  link: string;
  title: string;
  type: SourceType;
  items: Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>[];
  categoryName: string;
  workspaceId: number;
  showInWorkspace: boolean;
  icon?: string;
}

export type AddFeedError = { name: 'DB_ERROR'; message: string };

/** The full row set a freshly added feed needs internally (e.g. to enrich its items). Never sent over IPC as-is. */
export type AddedFeed = FeedMetadata & { items: FeedItem[]; category: FeedCategory; showInWorkspace: number; workspaceId: number };

export async function updateFeedItemImage(itemId: number, image: string): Promise<void> {
  await dbReady;
  try {
    await db.updateTable('feedItem').set({ image }).where('id', '=', itemId).execute();
  } catch (error) {
    console.error(`Failed to persist image for feed item ${itemId}.`, error);
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
    console.error(`Failed to persist article content for item ${content.item_id}.`, error);
  }
}

export async function addFeedToDatabase(input: NewFeedInput): Promise<Result<AddedFeed, AddFeedError>> {
  await dbReady;
  try {
    const { category, metadata, placement } = await db.transaction().execute(async (trx) => {
      const category = await addFeedCategoryToDatabase(trx, input.categoryName, input.workspaceId);
      const metadata = await addFeedMetadataToDatabase(trx, input.link, input.title, input.type, input.icon);
      const placement = await addFeedPlacementToDatabase(trx, metadata.id, category.id, input.workspaceId, input.showInWorkspace);
      const items = await addFeedItemsToDatabase(trx, metadata.id, input.items);
      if (!items.success) {
        throw new Error(items.error.message);
      }
      return { category, metadata, placement };
    });

    const items = await queryFeedItems({ feed_id: metadata.id });
    return { success: true, data: { ...metadata, items, category, showInWorkspace: placement.showInWorkspace, workspaceId: placement.workspace_id } };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
