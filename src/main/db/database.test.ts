import { afterEach, describe, expect, test, beforeEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { closeDatabase, db, dbReady, initializeDatabase } from './database';

describe('initializeDatabase', () => {
  beforeEach(async () => {
    await initializeDatabase(':memory:');
  });

  afterEach(async () => {
    await closeDatabase();
  });

  test('creates the feedCategory, feedMetadata, feedItem, setting and articleContent tables', async () => {
    // Act
    const tables = await db.introspection.getTables();

    // Assert
    expect(tables.map((table) => table.name).sort()).toEqual([
      'articleContent', 'feedCategory', 'feedItem', 'feedMetadata', 'setting',
    ]);
  });

  test('defines the columns the query and insert layers rely on', async () => {
    // Act
    const tables = await db.introspection.getTables();
    const columnsOf = (tableName: string) =>
      tables.find((table) => table.name === tableName)?.columns.map((column) => column.name).sort();

    // Assert
    expect(columnsOf('feedCategory')).toEqual(['id', 'name']);
    expect(columnsOf('feedMetadata')).toEqual(['category_id', 'id', 'last_error', 'last_fetched_at', 'link', 'showInHome', 'title', 'type']);
    expect(columnsOf('feedItem')).toEqual(['author', 'description', 'extra', 'feed_id', 'guid', 'id', 'image', 'link', 'pubDate', 'read_at', 'title']);
    expect(columnsOf('setting')).toEqual(['key', 'value']);
    expect(columnsOf('articleContent')).toEqual(['html', 'item_id', 'status', 'text', 'word_count']);
  });

  test('the shared db is queryable once dbReady resolves', async () => {
    // Act
    await dbReady;

    // Assert
    await expect(db.selectFrom('feedCategory').selectAll().execute()).resolves.toEqual([]);
  });
});

describe('reopening an already-migrated file', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'monfil-db-'));
    filePath = path.join(dir, 'monfil.db');
    await initializeDatabase(filePath);
  });

  afterEach(async () => {
    await closeDatabase();
    // Windows can hold the file's OS-level lock briefly after better-sqlite3's close() returns.
    await rm(dir, { recursive: true, maxRetries: 3, retryDelay: 100 });
  });

  test('a second initialization against the same file resolves without error', async () => {
    // Arrange
    await closeDatabase();

    // Act
    // Assert
    await expect(initializeDatabase(filePath)).resolves.toBeUndefined();
  });

  test('data written by one connection is readable by a later connection to the same file', async () => {
    // Arrange
    await db.insertInto('feedCategory').values({ name: 'tech' }).execute();
    await closeDatabase();

    // Act
    await initializeDatabase(filePath);
    const categories = await db.selectFrom('feedCategory').selectAll().execute();

    // Assert
    expect(categories.map((category) => category.name)).toEqual(['tech']);
  });
});

describe('recovering from a corrupted database file', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'monfil-db-'));
    filePath = path.join(dir, 'monfil.db');
  });

  afterEach(async () => {
    await closeDatabase();
    // Windows can hold the file's OS-level lock briefly after better-sqlite3's close() returns.
    await rm(dir, { recursive: true, maxRetries: 3, retryDelay: 100 });
  });

  // The recovery branching itself is covered in detail by db/recovery.test.ts. This is an end-to-end
  // check that initializeDatabase really is wired to it, against a real (not simulated) SQLite error.
  test('resets a database file that is not valid SQLite instead of throwing', async () => {
    // Arrange
    await writeFile(filePath, 'not a sqlite database');

    // Act
    await expect(initializeDatabase(filePath)).resolves.toBeUndefined();

    // Assert
    await expect(db.selectFrom('feedCategory').selectAll().execute()).resolves.toEqual([]);
  });
});
