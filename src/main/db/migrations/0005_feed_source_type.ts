// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('feedMetadata')
    .addColumn('type', 'text', (col) => col.notNull().defaultTo('rss'))
    .execute();

  await db.schema.alterTable('feedMetadata').addColumn('last_fetched_at', 'text').execute();
  await db.schema.alterTable('feedMetadata').addColumn('last_error', 'text').execute();

  await db.schema.alterTable('feedItem').addColumn('author', 'text').execute();

  // A JSON blob for the fields only some source types carry (episode duration, post handle, ...).
  // Nothing writes it until a second type exists; the column is here now because threading a new column
  // through CriteriaHandlers, the IPC types and RiverItem later costs more than the ADD COLUMN does.
  await db.schema.alterTable('feedItem').addColumn('extra', 'text').execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('feedItem').dropColumn('extra').execute();
  await db.schema.alterTable('feedItem').dropColumn('author').execute();
  await db.schema.alterTable('feedMetadata').dropColumn('last_error').execute();
  await db.schema.alterTable('feedMetadata').dropColumn('last_fetched_at').execute();
  await db.schema.alterTable('feedMetadata').dropColumn('type').execute();
}
