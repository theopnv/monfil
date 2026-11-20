// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { sql } from 'kysely';
import { db, dbReady, vacuumDatabase } from './database';
import type { RetentionDays, SourceItem } from '../../shared/contracts';
import { logger } from '../logging/logger';
import { publishedAtOrFallback } from './dates';

const DAY_MS = 86_400_000;
const VACUUM_THRESHOLD = 1_000;

export function retentionCutoff(days: RetentionDays, now = Date.now()): number {
  return now - days * DAY_MS;
}

export function isItemExpired(item: Pick<SourceItem, 'pubDate'>, cutoff: number, fetchedAt = Date.now()): boolean {
  return publishedAtOrFallback(item.pubDate, fetchedAt) < cutoff;
}

export function retainedFetchedItems<T extends Pick<SourceItem, 'pubDate'>>(items: T[], cutoff: number, fetchedAt = Date.now()): T[] {
  const dated = items.map((item) => ({ item, publishedAt: publishedAtOrFallback(item.pubDate, fetchedAt) }));
  const newest = new Set(dated.toSorted((a, b) => b.publishedAt - a.publishedAt).slice(0, 10).map(({ item }) => item));
  return dated.filter(({ item, publishedAt }) => newest.has(item) || publishedAt >= cutoff).map(({ item }) => item);
}

export async function pruneExpiredItems(days: RetentionDays, now = Date.now()): Promise<number> {
  await dbReady;
  const cutoff = retentionCutoff(days, now);
  const result = await db.deleteFrom('feedItem')
    .where((eb) => eb.not(eb.exists(eb.selectFrom('savedItem').select('item_id').whereRef('savedItem.item_id', '=', 'feedItem.id'))))
    .where('published_at', '<', cutoff)
    .where(sql<boolean>`id NOT IN (
      SELECT id FROM (
        SELECT id, ROW_NUMBER() OVER (PARTITION BY feed_id ORDER BY published_at DESC, id DESC) AS item_rank
        FROM feedItem
      ) WHERE item_rank <= 10
    )`)
    .executeTakeFirstOrThrow();
  const removed = Number(result.numDeletedRows);
  if (removed >= VACUUM_THRESHOLD) {
    try {
      vacuumDatabase();
    } catch (error) {
      logger.error('operation.failure', { operation: 'database-retention-vacuum' }, error);
    }
  }
  return removed;
}
