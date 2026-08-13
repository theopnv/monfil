import { describe, expect, test } from 'vitest';
import SQLite from 'better-sqlite3';
import { Kysely, SqliteDialect } from 'kysely';
import type { Database } from './types';
import { createSchema, db, dbReady } from './database';

function freshTestDatabase() {
  return new Kysely<Database>({
    dialect: new SqliteDialect({ database: new SQLite(':memory:') }),
  });
}

describe('createSchema', () => {
  test('querying a table before the schema is created fails', async () => {
    const testDb = freshTestDatabase();

    await expect(
      testDb.selectFrom('feedCategory').selectAll().execute()
    ).rejects.toThrow(/no such table/i);
  });

  test('creates the feedCategory, feedMetadata and feedItem tables', async () => {
    const testDb = freshTestDatabase();
    await createSchema(testDb);

    const tables = await testDb.introspection.getTables();

    expect(tables.map((table) => table.name).sort()).toEqual([
      'feedCategory',
      'feedItem',
      'feedMetadata',
    ]);
  });

  test('defines the columns the query and insert layers rely on', async () => {
    const testDb = freshTestDatabase();
    await createSchema(testDb);

    const tables = await testDb.introspection.getTables();
    const columnsOf = (tableName: string) =>
      tables
        .find((table) => table.name === tableName)
        ?.columns.map((column) => column.name)
        .sort();

    expect(columnsOf('feedCategory')).toEqual(['id', 'name']);
    expect(columnsOf('feedMetadata')).toEqual(['category_id', 'id', 'link', 'title']);
    expect(columnsOf('feedItem')).toEqual(['description', 'feed_id', 'id', 'link', 'pubDate', 'title']);
  });

  test('is safe to run more than once', async () => {
    const testDb = freshTestDatabase();

    await createSchema(testDb);
    await expect(createSchema(testDb)).resolves.not.toThrow();
  });
});

describe('dbReady', () => {
  test('the shared db is queryable once dbReady resolves', async () => {
    await dbReady;

    await expect(db.selectFrom('feedCategory').selectAll().execute()).resolves.toEqual([]);
  });
});
