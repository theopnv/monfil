import { type Kysely } from 'kysely';
import { db, dbReady } from '../database';
import { queryFeedItems } from './query';
import type { Database, FeedItem, NewArticleContent } from './types';
import type { Feed } from '../../preload/channels';
import type { Result } from '../../utils';

async function addFeedCategoryToDatabase(trx: Kysely<Database>, categoryName: string) {
  return trx.insertInto('feedCategory')
    .values({ name: categoryName })
    .onConflict((oc) => oc.column('name').doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

async function addFeedMetadataToDatabase(trx: Kysely<Database>, link: string, title: string, categoryId: number, showInHome: boolean) {
  return trx.insertInto('feedMetadata')
    .values({ link, title, category_id: categoryId, showInHome: showInHome ? 1 : 0 })
    .onConflict((oc) => oc.column('link').doUpdateSet((eb) => ({
      title: eb.ref('excluded.title'),
      category_id: eb.ref('excluded.category_id'),
      showInHome: eb.ref('excluded.showInHome'),
    })))
    .returningAll()
    .executeTakeFirstOrThrow();
}

/**
 * Inserts the items of one feed, skipping the links that are already stored.
 * @param executor the `db` singleton, or a transaction to insert within
 * @param feedId the id of the feed the items belong to
 * @param items the items to insert
 * @returns only the rows it wrote, since `ON CONFLICT DO NOTHING ... RETURNING *` leaves out the skipped ones
 */
export async function addFeedItemsToDatabase(executor: Kysely<Database>, feedId: number, items: Omit<FeedItem, 'id' | 'feed_id'>[]): Promise<FeedItem[]> {
  if (items.length === 0) return [];
  return executor.insertInto('feedItem')
    .values(items.map((item) => ({ feed_id: feedId, ...item })))
    .onConflict((oc) => oc.column('link').doNothing())
    .returningAll()
    .execute();
}

export interface NewFeedInput {
  link: string;
  title: string;
  items: Omit<FeedItem, 'id' | 'feed_id'>[];
  categoryName: string;
  showInHome: boolean;
}

export type AddFeedError = { name: 'DB_ERROR'; message: string };

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

export async function addFeedToDatabase(input: NewFeedInput): Promise<Result<Feed, AddFeedError>> {
  await dbReady;
  try {
    const { category, metadata } = await db.transaction().execute(async (trx) => {
      const category = await addFeedCategoryToDatabase(trx, input.categoryName);
      const metadata = await addFeedMetadataToDatabase(trx, input.link, input.title, category.id, input.showInHome);
      await addFeedItemsToDatabase(trx, metadata.id, input.items);
      return { category, metadata };
    });

    const items = await queryFeedItems({ feed_id: metadata.id });
    return { success: true, data: { ...metadata, items, category } };
  } catch (error) {
    return { success: false, error: { name: 'DB_ERROR', message: error instanceof Error ? error.message : 'An unknown error occurred' } };
  }
}
