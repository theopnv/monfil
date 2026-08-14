import { afterEach, describe, expect, test, beforeEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
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

  test('creates the feedCategory, feedMetadata and feedItem tables', async () => {
    // Act
    const tables = await db.introspection.getTables();

    // Assert
    expect(tables.map((table) => table.name).sort()).toEqual([
      'feedCategory', 'feedItem', 'feedMetadata',
    ]);
  });

  test('defines the columns the query and insert layers rely on', async () => {
    // Act
    const tables = await db.introspection.getTables();
    const columnsOf = (tableName: string) =>
      tables.find((table) => table.name === tableName)?.columns.map((column) => column.name).sort();

    // Assert
    expect(columnsOf('feedCategory')).toEqual(['id', 'name']);
    expect(columnsOf('feedMetadata')).toEqual(['category_id', 'id', 'link', 'showInHome', 'title']);
    expect(columnsOf('feedItem')).toEqual(['description', 'feed_id', 'id', 'image', 'link', 'pubDate', 'title']);
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
    await rm(dir, { recursive: true });
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
