// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { db, dbReady } from '../db/database';
import { isShuttingDown } from '../app/shutdown-state';
import { failureDetail } from './failure-detail';
import { logger } from '../logging/logger';
import { syncFeedItemsToDatabase, updateFeedItemImage } from '../db/crud/insert';
import { querySubscribedFeedMetadata } from '../db/crud/query';
import type { FeedItem, FeedMetadataRow } from '../db/types';
import { broadcastToRenderers } from '../lib/sendToRenderer';
import { enrichItems } from './enrichItems';
import { sourceFor } from './sources/registry';
import { setFeedFetchResult, setFeedIconIfMissing } from '../db/crud/update';
import { resolveSiteIcon } from './sources/siteIcon';
import type { RefreshSummary, RetentionDays, SourceType } from '../../shared/contracts';
import type { CodedError } from '../../shared/errors';
import { runWithConcurrency } from '../lib/utils';
import { FEED_FETCH_CONCURRENCY } from '../lib/constants';
import { getRetentionDays } from '../app/settings';
import { pruneExpiredItems, retentionCutoff } from '../db/retention';

const ENRICHMENT_BUDGET = 200;

const iconLookups = new Set<string>();

interface IconLookup {
  feed: FeedMetadataRow;
  siteLink: string | undefined;
}

function needsIconLookup(feed: FeedMetadataRow): boolean {
  return !feed.icon && !iconLookups.has(feed.link);
}

function claimIconLookup(feed: FeedMetadataRow): boolean {
  if (!needsIconLookup(feed)) {
    return false;
  }
  iconLookups.add(feed.link);
  return true;
}

async function fillMissingIcon({ feed, siteLink }: IconLookup): Promise<boolean> {
  const icon = await resolveSiteIcon(siteLink ?? feed.link);
  if (!icon || isShuttingDown()) {
    return false;
  }
  const stored = await setFeedIconIfMissing(feed.id, icon);
  if (!stored.success) {
    logger.error('operation.failure', { operation: 'store-feed-icon', entityId: feed.id }, stored.error);
  }
  return stored.success;
}

async function fillMissingIcons(lookups: readonly IconLookup[]): Promise<void> {
  let stored = 0;
  await runWithConcurrency(lookups, FEED_FETCH_CONCURRENCY, async (lookup) => {
    if (await fillMissingIcon(lookup)) {
      stored += 1;
    }
  });
  if (stored > 0) {
    broadcastToRenderers('feeds:refreshed', { perFeed: [] });
  }
}

/** False once the app is quitting, because the database may close at any moment, and false for a feed that was removed. */
async function isStillSubscribed(feedId: number): Promise<boolean> {
  return !isShuttingDown() && (await querySubscribedFeedMetadata([feedId])).length > 0;
}

async function refreshOneFeed(feed: FeedMetadataRow, cutoff: number, force: boolean): Promise<{ items: FeedItem[]; updated: number; failure?: CodedError; iconLookup?: IconLookup }> {
  if (!await isStillSubscribed(feed.id)) {
    return { items: [], updated: 0 };
  }
  // A 304 carries no site link, so a feed still owed its icon lookup is fetched in full once.
  const conditional = !force && !needsIconLookup(feed);
  const result = await sourceFor(feed.type).fetch({ link: feed.link, ...(conditional ? { validators: { etag: feed.etag ?? undefined, last_modified: feed.last_modified ?? undefined } } : {}) });
  if (!await isStillSubscribed(feed.id)) {
    return { items: [], updated: 0 };
  }
  if (!result.success) {
    logger.warn('feed.refresh', { outcome: 'failed', feedId: feed.id, errorCode: result.error.name, ...failureDetail(result.error) }, result.error);
    const updated = await setFeedFetchResult(feed.id, {
      last_error: result.error.message,
      last_error_code: result.error.name,
      ...(result.error.params ? { last_error_params: result.error.params } : {}),
    });
    if (!updated.success) {
      logger.error('operation.failure', { operation: 'store-refresh-failure', entityId: feed.id }, updated.error);
    }
    return { items: [], updated: 0, failure: result.error };
  }

  // A 304 keeps the stored validators as-is; a full fetch replaces them with the ones the server
  // just sent, which may be none.
  const outcome = result.data;
  if ('notModified' in outcome) {
    const updated = await setFeedFetchResult(feed.id, { last_error: null });
    if (!updated.success) {
      logger.error('operation.failure', { operation: 'clear-refresh-failure', entityId: feed.id }, updated.error);
    }
    return { items: [], updated: 0 };
  }

  const inserted = await syncFeedItemsToDatabase(db, feed.id, outcome.parsed.items, cutoff);
  if (!inserted.success) {
    logger.error('operation.failure', { operation: 'store-refreshed-items', entityId: feed.id }, inserted.error);
    const failure: CodedError = { name: 'DB_ERROR', message: 'Could not save the new items.' };
    return { items: [], updated: 0, failure };
  }

  const lookupIcon = claimIconLookup(feed);

  // Advance validators only after the response items are stored, so a 304 cannot hide an insert failure.
  const updated = await setFeedFetchResult(feed.id, {
    last_error: null,
    etag: outcome.validators.etag ?? null,
    last_modified: outcome.validators.last_modified ?? null,
  });
  if (!updated.success) {
    logger.error('operation.failure', { operation: 'clear-refresh-failure', entityId: feed.id }, updated.error);
  }
  return { items: inserted.data.inserted, updated: inserted.data.updated, ...(lookupIcon ? { iconLookup: { feed, siteLink: outcome.parsed.siteLink } } : {}) };
}

async function refreshFeedList(feedList: FeedMetadataRow[], retentionDays: RetentionDays, force = false): Promise<RefreshSummary> {
  const insertedByFeedId = new Map<number, FeedItem[]>();
  const updatedByFeedId = new Map<number, number>();
  const failedFeeds: NonNullable<RefreshSummary['failedFeeds']> = [];
  const pendingIconLookups: IconLookup[] = [];
  const cutoff = retentionCutoff(retentionDays);

  await runWithConcurrency(feedList, FEED_FETCH_CONCURRENCY, async (feed) => {
    if (isShuttingDown()) {
      return;
    }
    const result = await refreshOneFeed(feed, cutoff, force);
    insertedByFeedId.set(feed.id, result.items);
    updatedByFeedId.set(feed.id, result.updated);
    if (result.iconLookup) {
      pendingIconLookups.push(result.iconLookup);
    }
    if (result.failure !== undefined) {
      failedFeeds.push({ feedId: feed.id, title: feed.title, message: result.failure.message, code: result.failure.name, ...(result.failure.params ? { params: result.failure.params } : {}) });
    }
  });

  const removed = isShuttingDown() ? 0 : await pruneExpiredItems(retentionDays);

  const typeByFeedId = new Map(feedList.map((feed) => [feed.id, feed.type]));

  fillMissingIcons(pendingIconLookups).catch((error: unknown) => {
    logger.error('operation.failure', { operation: 'fill-feed-icons' }, error);
  });

  // Images take a page fetch each, so they arrive later through their own push rather than holding up the list.
  enrichRefreshedItems(insertedByFeedId, typeByFeedId).catch((error: unknown) => {
    logger.error('operation.failure', { operation: 'enrich-feed-images' }, error);
  });

  return {
    perFeed: [...insertedByFeedId.entries()].map(([feedId, items]) => {
      const updated = updatedByFeedId.get(feedId) ?? 0;
      return { feedId, inserted: items.length, ...(updated > 0 ? { updated } : {}) };
    }),
    ...(removed > 0 ? { removed } : {}),
    ...(failedFeeds.length > 0 ? { failedFeeds } : {}),
  };
}

/**
 * Fetches every subscribed feed and synchronizes publisher changes and retained history.
 * A feed that fails to fetch is logged and skipped, so the others still get their items.
 */
export async function refreshAllFeeds(force = false): Promise<RefreshSummary> {
  await dbReady;
  const [feedList, retentionDays] = await Promise.all([querySubscribedFeedMetadata(), getRetentionDays()]);
  return refreshFeedList(feedList, retentionDays, force);
}

/**
 * Fetches only the given feeds. Used right after an OPML import (or pack install), whose rows
 * are written with no items so the new tab has something to show while this runs.
 */
export async function refreshFeeds(feedIds: number[], force = false): Promise<RefreshSummary> {
  if (feedIds.length === 0) {
    return { perFeed: [] };
  }
  await dbReady;
  const [feedList, retentionDays] = await Promise.all([querySubscribedFeedMetadata(feedIds), getRetentionDays()]);
  return refreshFeedList(feedList, retentionDays, force);
}

async function enrichRefreshedItems(insertedByFeedId: ReadonlyMap<number, FeedItem[]>, typeByFeedId: ReadonlyMap<number, SourceType>): Promise<void> {
  const candidates: FeedItem[] = [];
  for (const [feedId, items] of insertedByFeedId) {
    if (sourceFor(typeByFeedId.get(feedId) ?? 'rss').fetchesFullArticle) {
      candidates.push(...items.slice(0, ENRICHMENT_BUDGET - candidates.length));
    }
  }
  try {
    await enrichItems(
      candidates,
      (item, image) => {
        if (isShuttingDown()) {
          return;
        }
        void updateFeedItemImage(item.id, image);
        broadcastToRenderers('feeds:item-image-fetched', { feedId: item.feed_id, itemId: item.id, image });
      },
    );
  } catch (error) {
    logger.error('operation.failure', { operation: 'enrich-feed-images' }, error);
  }
}
