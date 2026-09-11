// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
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
    .addColumn('type', 'text', (col) => col.notNull().defaultTo('rss'))
    .addColumn('last_fetched_at', 'text')
    .addColumn('last_error', 'text')
    .execute();

  await db.schema
    .createTable('feedItem')
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id').onDelete('cascade'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('guid', 'text', (col) => col.notNull())
    .addColumn('link', 'text')
    .addColumn('pubDate', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .addColumn('image', 'text')
    .addColumn('author', 'text')
    .addColumn('extra', 'text')
    .addColumn('read_at', 'text')
    .addUniqueConstraint('feedItem_feed_guid_unique', ['feed_id', 'guid'])
    .execute();

  await db.schema
    .createTable('articleContent')
    .addColumn('item_id', 'integer', (col) => col.primaryKey().references('feedItem.id').onDelete('cascade'))
    .addColumn('html', 'text')
    .addColumn('text', 'text')
    .addColumn('word_count', 'integer')
    .addColumn('status', 'text', (col) => col.notNull())
    .execute();

  await db.schema
    .createTable('setting')
    .addColumn('key', 'text', (col) => col.primaryKey())
    .addColumn('value', 'text', (col) => col.notNull())
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable('setting').execute();
  await db.schema.dropTable('articleContent').execute();
  await db.schema.dropTable('feedItem').execute();
  await db.schema.dropTable('feedMetadata').execute();
  await db.schema.dropTable('feedCategory').execute();
}
