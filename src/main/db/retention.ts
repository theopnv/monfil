import { sql } from 'kysely';
import { db, dbReady, vacuumDatabase } from './database';
import type { RetentionDays, SourceItem } from '../../shared/contracts';
import { logger } from '../logging/logger';

const DAY_MS = 86_400_000;
const VACUUM_THRESHOLD = 1_000;

export function retentionCutoff(days: RetentionDays, now = Date.now()): number {
  return now - days * DAY_MS;
}

export function isItemExpired(item: Pick<SourceItem, 'pubDate'>, cutoff: number, fetchedAt = Date.now()): boolean {
  const published = new Date(item.pubDate).getTime();
  return (Number.isFinite(published) ? published : fetchedAt) < cutoff;
}

export function retainedFetchedItems<T extends Pick<SourceItem, 'pubDate'>>(items: T[], cutoff: number, fetchedAt = Date.now()): T[] {
  const newest = new Set([...items]
    .sort((a, b) => (Number.isFinite(new Date(b.pubDate).getTime()) ? new Date(b.pubDate).getTime() : fetchedAt)
      - (Number.isFinite(new Date(a.pubDate).getTime()) ? new Date(a.pubDate).getTime() : fetchedAt))
    .slice(0, 10));
  return items.filter((item) => newest.has(item) || !isItemExpired(item, cutoff, fetchedAt));
}

export async function pruneExpiredItems(days: RetentionDays, now = Date.now()): Promise<number> {
  await dbReady;
  const cutoff = retentionCutoff(days, now);
  const result = await db.deleteFrom('feedItem')
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
