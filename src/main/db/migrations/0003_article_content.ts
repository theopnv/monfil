// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
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
