// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Database } from 'better-sqlite3';
import type { Kysely } from 'kysely';

export async function up(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('feedCategory')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .execute();

  await db.schema
    .createTable('feedMetadata')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('link', 'text', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('category_id', 'integer', (col) => col.notNull().references('feedCategory.id'))
    .addColumn('showInHome', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();

  await db.schema
    .createTable('feedItem')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id').onDelete('cascade'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('link', 'text', (col) => col.unique())
    .addColumn('pubDate', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('image', 'text')
    .execute();

  await db.schema
    .createTable('setting')
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'text', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('setting').execute();
  await db.schema.dropTable('feedItem').execute();
  await db.schema.dropTable('feedMetadata').execute();
  await db.schema.dropTable('feedCategory').execute();
}
