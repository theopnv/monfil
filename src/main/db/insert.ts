import { type Kysely } from 'kysely';
import { db, dbReady } from '../database';
import { queryFeedItems } from './query';
import type { Database, FeedItem } from './types';
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

async function addFeedItemsToDatabase(trx: Kysely<Database>, feedId: number, items: Omit<FeedItem, 'id' | 'feed_id'>[]) {
  if (items.length === 0) return;
  return trx.insertInto('feedItem')
    .values(items.map((item) => ({ feed_id: feedId, ...item })))
    .onConflict((oc) => oc.column('link').doNothing())
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
