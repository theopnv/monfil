// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { sql, type Kysely } from 'kysely';
import { stripHtml, truncateOnWordBoundary } from '../../lib/strip-html';

const EXCERPT_MAX_LENGTH = 200;
const BACKFILL_BATCH_SIZE = 500;

// SQLite cannot parse RFC-822 pubDates, so this must run in JS during the backfill.
function parsePublishedAt(pubDate: string): number {
  const timestamp = new Date(pubDate).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

interface BackfillRow {
  id: number;
  pubDate: string;
  description: string;
}

async function backfillFeedItems(db: Kysely<any>): Promise<void> {
  let lastId = 0;
  for (;;) {
    const rows: BackfillRow[] = await db.selectFrom('feedItem')
      .select(['id', 'pubDate', 'description'])
      .where('id', '>', lastId)
      .orderBy('id')
      .limit(BACKFILL_BATCH_SIZE)
      .execute();
    if (rows.length === 0) {
      return;
    }

    for (const row of rows) {
      await db.updateTable('feedItem')
        .set({
          published_at: parsePublishedAt(row.pubDate),
          excerpt: truncateOnWordBoundary(stripHtml(row.description), EXCERPT_MAX_LENGTH),
        })
        .where('id', '=', row.id)
        .execute();
      lastId = row.id;
    }
  }
}

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('feedItem').addColumn('published_at', 'integer', (col) => col.notNull().defaultTo(0)).execute();
  await db.schema.alterTable('feedItem').addColumn('excerpt', 'text', (col) => col.notNull().defaultTo('')).execute();

  await backfillFeedItems(db);

  // The river sort.
  await db.schema.createIndex('feedItem_published_at_id').on('feedItem').columns(['published_at desc', 'id desc']).execute();
  // The feed filter and the cascade delete.
  await db.schema.createIndex('feedItem_feed_id').on('feedItem').column('feed_id').execute();
  // Partial, so the unreadOnly path stays index-only.
  await db.schema.createIndex('feedItem_unread').on('feedItem').columns(['published_at desc', 'id desc']).where(sql.ref('read_at'), 'is', null).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('feedItem_unread').execute();
  await db.schema.dropIndex('feedItem_feed_id').execute();
  await db.schema.dropIndex('feedItem_published_at_id').execute();
  await db.schema.alterTable('feedItem').dropColumn('excerpt').execute();
  await db.schema.alterTable('feedItem').dropColumn('published_at').execute();
}
