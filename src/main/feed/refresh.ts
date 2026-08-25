import { db, dbReady } from '../database';
import { addFeedItemsToDatabase, updateFeedItemImage, upsertArticleContent } from '../db/insert';
import { queryFeedMetadata, queryFeeds } from '../db/query';
import type { FeedItem, FeedMetadata } from '../db/types';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import { enrichItems } from './enrichItems';
import { fetchFeed } from './parse';
import type { Feed } from '../../preload/channels';
import { runWithConcurrency } from '../../utils';

export const FEED_FETCH_CONCURRENCY = 4;

async function refreshOneFeed(feed: FeedMetadata): Promise<FeedItem[]> {
  const result = await fetchFeed(feed.link);
  if (!result.success) {
    console.error(`Failed to refresh feed "${feed.title}" (${feed.link}).`, result.error);
    return [];
  }

  // feedItem.link is UNIQUE but nullable, and SQLite accepts any number of NULLs in a unique column,
  // so a linkless item would be inserted again on every cycle.
  const items = result.data.items.filter((item) => item.link);
  return addFeedItemsToDatabase(db, feed.id, items);
}

/**
 * Fetches every stored feed and inserts the items that are not stored yet. Nothing is updated or deleted.
 * A feed that fails to fetch is logged and skipped, so the others still get their items.
 * @returns the full, current feed list, without the images that are still being fetched
 */
export async function refreshAllFeeds(): Promise<Feed[]> {
  await dbReady;
  const feedList = await queryFeedMetadata({});
  const insertedByFeedId = new Map<number, FeedItem[]>();

  await runWithConcurrency(feedList, FEED_FETCH_CONCURRENCY, async (feed) => {
    try {
      insertedByFeedId.set(feed.id, await refreshOneFeed(feed));
    } catch (error) {
      console.error(`Failed to store the refreshed items of feed "${feed.title}".`, error);
    }
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
