import type { Kysely } from 'kysely';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema.createTable('undatedItem')
    .addColumn('feed_id', 'integer', (column) => column.notNull().references('feedMetadata.id').onDelete('cascade'))
    .addColumn('guid', 'text', (column) => column.notNull())
    .addColumn('first_fetched_at', 'integer', (column) => column.notNull())
    .addPrimaryKeyConstraint('undatedItem_pk', ['feed_id', 'guid'])
    .execute();
  const now = Date.now();
  const unknown = (await db.selectFrom('feedItem').select(['id', 'feed_id', 'guid', 'pubDate']).where('published_at', '=', 0).execute())
    .filter((item) => !Number.isFinite(new Date(item.pubDate).getTime()));
  for (let offset = 0; offset < unknown.length; offset += 300) {
    const batch = unknown.slice(offset, offset + 300);
    await db.insertInto('undatedItem').values(batch.map((item) => ({ feed_id: item.feed_id, guid: item.guid, first_fetched_at: now }))).execute();
    await db.updateTable('feedItem').set({ published_at: now }).where('id', 'in', batch.map((item) => item.id)).execute();
  }
  await db.schema.createIndex('feedItem_retention').on('feedItem').columns(['feed_id', 'published_at', 'id']).execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropIndex('feedItem_retention').execute();
  await db.schema.dropTable('undatedItem').execute();
}
