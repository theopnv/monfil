import { db, dbReady } from '../db/database';
import { logger } from '../logging/logger';
import { addFeedItemsToDatabase, updateFeedItemImage } from '../db/crud/insert';
import { queryFeedMetadata, queryFeedMetadataByIds } from '../db/crud/query';
import type { FeedItem, FeedMetadataRow } from '../db/types';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import { enrichItems } from './enrichItems';
import { sourceFor } from './sources/registry';
import { setFeedFetchResult } from '../db/crud/update';
import type { RefreshSummary, SourceType } from '../../shared/contracts';
import { runWithConcurrency } from '../lib/utils';
import { FEED_FETCH_CONCURRENCY } from '../constants';
import { getMaxFeedItems } from '../settings';

const ENRICHMENT_BUDGET = 200;

async function refreshOneFeed(feed: FeedMetadataRow, maxItems: number): Promise<{ items: FeedItem[]; failed: boolean }> {
  const result = await sourceFor(feed.type).fetch({ link: feed.link, maxItems, validators: { etag: feed.etag ?? undefined, last_modified: feed.last_modified ?? undefined } });
  if (!result.success) {
    logger.warn('feed.refresh', { outcome: 'failed', feedId: feed.id, errorCode: result.error.name }, result.error);
    const updated = await setFeedFetchResult(feed.id, { last_error: result.error.message });
    if (!updated.success) {
      logger.error('operation.failure', { operation: 'store-refresh-failure', entityId: feed.id }, updated.error);
    }
    return { items: [], failed: true };
  }

  // A 304 keeps the stored validators as-is; a full fetch replaces them with the ones the server
  // just sent, which may be none.
  const outcome = result.data;
  if ('notModified' in outcome) {
    const updated = await setFeedFetchResult(feed.id, { last_error: null });
    if (!updated.success) {
      logger.error('operation.failure', { operation: 'clear-refresh-failure', entityId: feed.id }, updated.error);
    }
    return { items: [], failed: false };
  }

  const inserted = await addFeedItemsToDatabase(db, feed.id, outcome.parsed.items);
  if (!inserted.success) {
    logger.error('operation.failure', { operation: 'store-refreshed-items', entityId: feed.id }, inserted.error);
    return { items: [], failed: true };
  }

  // Advance validators only after the response items are stored, so a 304 cannot hide an insert failure.
  const updated = await setFeedFetchResult(feed.id, {
    last_error: null,
    etag: outcome.validators.etag ?? null,
    last_modified: outcome.validators.last_modified ?? null,
  });
  if (!updated.success) {
    logger.error('operation.failure', { operation: 'clear-refresh-failure', entityId: feed.id }, updated.error);
  }
  return { items: inserted.data, failed: false };
}

async function refreshFeedList(feedList: FeedMetadataRow[], maxItems: number): Promise<RefreshSummary> {
  const insertedByFeedId = new Map<number, FeedItem[]>();
  const failedFeedIds: number[] = [];

  await runWithConcurrency(feedList, FEED_FETCH_CONCURRENCY, async (feed) => {
    const result = await refreshOneFeed(feed, maxItems);
    insertedByFeedId.set(feed.id, result.items);
    if (result.failed) {
      failedFeedIds.push(feed.id);
    }
  });

  const typeByFeedId = new Map(feedList.map((feed) => [feed.id, feed.type]));

  // Images take a page fetch each, so they arrive later through their own push rather than holding up the list.
  enrichRefreshedItems(insertedByFeedId, typeByFeedId).catch((error: unknown) => {
    logger.error('operation.failure', { operation: 'enrich-feed-images' }, error);
  });

  return {
    perFeed: [...insertedByFeedId.entries()].map(([feedId, items]) => ({ feedId, inserted: items.length })),
    ...(failedFeedIds.length > 0 ? { failedFeedIds } : {}),
  };
}

/**
 * Fetches every stored feed and inserts the items that are not stored yet. Nothing is updated or deleted.
 * A feed that fails to fetch is logged and skipped, so the others still get their items.
 * @returns how many items each feed gained, so the renderer can show a pill without receiving the rows themselves
 */
export async function refreshAllFeeds(): Promise<RefreshSummary> {
  await dbReady;
  const [feedList, maxItems] = await Promise.all([queryFeedMetadata({}), getMaxFeedItems()]);
  return refreshFeedList(feedList, maxItems);
}

/**
 * Fetches only the given feeds. Used right after an OPML import (or pack install), whose rows
 * are written with no items so the new tab has something to show while this runs.
 * @param feedIds the ids of the feeds to fetch
 */
export async function refreshFeeds(feedIds: number[]): Promise<RefreshSummary> {
  if (feedIds.length === 0) {
    return { perFeed: [] };
  }
  await dbReady;
  const [feedList, maxItems] = await Promise.all([queryFeedMetadataByIds(feedIds), getMaxFeedItems()]);
  return refreshFeedList(feedList, maxItems);
}

async function enrichRefreshedItems(insertedByFeedId: ReadonlyMap<number, FeedItem[]>, typeByFeedId: ReadonlyMap<number, SourceType>): Promise<void> {
  let remaining = ENRICHMENT_BUDGET;
  for (const [feedId, items] of insertedByFeedId) {
    if (remaining === 0) {
      return;
    }
    if (!sourceFor(typeByFeedId.get(feedId) ?? 'rss').fetchesFullArticle) {
      continue;
    }
    const candidates = items.slice(0, remaining);
    remaining -= candidates.length;
    await enrichItems(
      candidates,
      (itemId, image) => {
        void updateFeedItemImage(itemId, image);
        broadcastToRenderers('feeds:item-image-fetched', { feedId, itemId, image });
      },
    );
  }
}
