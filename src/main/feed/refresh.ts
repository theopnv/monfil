import { db, dbReady } from '../db/database';
import { addFeedItemsToDatabase, updateFeedItemImage, upsertArticleContent } from '../db/crud/insert';
import { queryFeedMetadata, queryFeeds } from '../db/crud/query';
import type { FeedItem, FeedMetadata } from '../db/types';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import { enrichItems } from './enrichItems';
import { sourceFor } from './sources/registry';
import { setFeedFetchResult } from '../db/crud/update';
import type { Feed } from '../../preload/channels';
import { runWithConcurrency } from '../lib/utils';
import { FEED_FETCH_CONCURRENCY } from '../constants';
import { getMaxFeedItems } from '../settings';

async function refreshOneFeed(feed: FeedMetadata, maxItems: number): Promise<FeedItem[]> {
  const result = await sourceFor(feed.type).fetch(feed.link, maxItems);
  if (!result.success) {
    console.error(`Failed to refresh feed "${feed.title}" (${feed.link}).`, result.error);
    await setFeedFetchResult(feed.id, { last_error: result.error.message });
    return [];
  }
  await setFeedFetchResult(feed.id, { last_error: null });

  const inserted = await addFeedItemsToDatabase(db, feed.id, result.data.items);
  if (!inserted.success) {
    console.error(`Failed to store the refreshed items of feed "${feed.title}" (${feed.link}).`, inserted.error);
    return [];
  }
  return inserted.data;
}

/**
 * Fetches every stored feed and inserts the items that are not stored yet. Nothing is updated or deleted.
 * A feed that fails to fetch is logged and skipped, so the others still get their items.
 * @returns the full, current feed list, without the images that are still being fetched
 */
export async function refreshAllFeeds(): Promise<Feed[]> {
  await dbReady;
  const [feedList, maxItems] = await Promise.all([queryFeedMetadata({}), getMaxFeedItems()]);
  const insertedByFeedId = new Map<number, FeedItem[]>();

  await runWithConcurrency(feedList, FEED_FETCH_CONCURRENCY, async (feed) => {
    insertedByFeedId.set(feed.id, await refreshOneFeed(feed, maxItems));
  });

  const feeds = await queryFeeds();

  // Images take a page fetch each, so they arrive later through their own push rather than holding up the list.
  enrichRefreshedItems(insertedByFeedId).catch((error: unknown) => {
    console.error('Failed to enrich the images of the refreshed items.', error);
  });

  return feeds;
}

async function enrichRefreshedItems(insertedByFeedId: ReadonlyMap<number, FeedItem[]>): Promise<void> {
  for (const [feedId, items] of insertedByFeedId) {
    await enrichItems(
      items,
      (itemId, image) => {
        void updateFeedItemImage(itemId, image);
        broadcastToRenderers('feeds:item-image-fetched', { feedId, itemId, image });
      },
      (itemId, content) => {
        void upsertArticleContent({ item_id: itemId, ...content });
      },
    );
  }
}
