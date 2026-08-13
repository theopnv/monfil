import type { Database } from './types.ts'
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'

const dialect = new SqliteDialect({
  database: new SQLite(':memory:'),
})

export const db = new Kysely<Database>({
  dialect,
})

export async function createSchema(db: Kysely<Database>): Promise<void> {
  await db.schema
    .createTable('feedCategory')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('name', 'text', (col) => col.notNull().unique())
    .execute();

  await db.schema
    .createTable('feedMetadata')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('link', 'text', (col) => col.notNull().unique())
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('category_id', 'integer', (col) => col.notNull().references('feedCategory.id'))
    .addColumn('showInHome', 'integer', (col) => col.notNull().defaultTo(1))
    .execute();

  await db.schema
    .createTable('feedItem')
    .ifNotExists()
    .addColumn('id', 'integer', (col) => col.primaryKey().autoIncrement())
    .addColumn('feed_id', 'integer', (col) => col.notNull().references('feedMetadata.id'))
    .addColumn('title', 'text', (col) => col.notNull())
    .addColumn('link', 'text', (col) => col.unique())
    .addColumn('pubDate', 'text', (col) => col.notNull())
    .addColumn('description', 'text', (col) => col.notNull())
    .execute();
}

// The database is in-memory and rebuilt on every process start, so schema
// creation runs here once instead of through a versioned migrator.
export const dbReady = createSchema(db);
