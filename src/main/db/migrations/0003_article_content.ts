// Migrations are typed against Kysely<any>, not Database, because a migration
// reflects the schema at that point in history rather than today's types.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable('articleContent')
    .addColumn('item_id', 'integer', (col) => col.primaryKey().references('feedItem.id').onDelete('cascade'))
    .addColumn('html', 'text')
    .addColumn('text', 'text')
    .addColumn('word_count', 'integer')
    .addColumn('status', 'text', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('articleContent').execute();
}
