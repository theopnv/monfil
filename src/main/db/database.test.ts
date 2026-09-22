import { afterEach, describe, expect, test, beforeEach } from 'vitest';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import SQLite from 'better-sqlite3';
import { sql } from 'kysely';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';
import { closeDatabase, db, dbReady, initializeDatabase } from './database';
import { rmTestDir } from '../lib/rmTestDir';

describe('initializeDatabase', () => {
  beforeEach(async () => {
    await initializeDatabase(':memory:');
  });

  afterEach(async () => {
    await closeDatabase();
  });

  test('creates the workspace, feedCategory, feedMetadata, feedPlacement, feedItem, setting and articleContent tables', async () => {
    // Act
    const tables = await db.introspection.getTables();

    // Assert
    expect(tables.map((table) => table.name).sort()).toEqual([
      'articleContent', 'feedCategory', 'feedItem', 'feedMetadata', 'feedPlacement', 'setting', 'workspace',
    ]);
  });

  test('defines the columns the query and insert layers rely on', async () => {
    // Act
    const tables = await db.introspection.getTables();
    const columnsOf = (tableName: string) =>
      tables.find((table) => table.name === tableName)?.columns.map((column) => column.name).sort();

    // Assert
    expect(columnsOf('workspace')).toEqual(['color', 'icon', 'id', 'installed_at', 'name', 'position', 'source_slug', 'source_version']);
    expect(columnsOf('feedCategory')).toEqual(['id', 'name', 'workspace_id']);
    expect(columnsOf('feedMetadata')).toEqual(['icon', 'id', 'last_error', 'last_fetched_at', 'link', 'title', 'type']);
    expect(columnsOf('feedPlacement')).toEqual(['category_id', 'feed_id', 'showInWorkspace', 'workspace_id']);
    expect(columnsOf('feedItem')).toEqual(['author', 'description', 'excerpt', 'extra', 'feed_id', 'guid', 'id', 'image', 'link', 'pubDate', 'published_at', 'read_at', 'title']);
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
    await rmTestDir(dir);
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
    await db.insertInto('feedCategory').values({ name: 'tech', workspace_id: HOME_WORKSPACE_ID }).execute();
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
    await rmTestDir(dir);
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

  // An already-migrated file's migration step touches only the migration bookkeeping table, so it can
  // succeed even when a data table is corrupted elsewhere in the file. Without an integrity check inside
  // the guarded attempt, that corruption would surface later as SQLITE_CORRUPT from the first real query
  // instead of being quarantined here.
  test('resets an already-migrated file whose data pages are corrupted, not just its header', async () => {
    // Arrange
    await initializeDatabase(filePath);
    await db.insertInto('setting').values({ key: 'theme', value: 'dark' }).execute();
    await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(db);
    await closeDatabase();

    const probe = new SQLite(filePath);
    const pageSize = probe.pragma('page_size', { simple: true }) as number;
    const { rootpage } = probe.prepare("SELECT rootpage FROM sqlite_master WHERE name = 'setting'").get() as { rootpage: number };
    probe.close();

    const bytes = await readFile(filePath);
    const pageStart = (rootpage - 1) * pageSize;
    bytes.subarray(pageStart, pageStart + pageSize).fill(0xff);
    await writeFile(filePath, bytes);

    // Act
    await expect(initializeDatabase(filePath)).resolves.toBeUndefined();

    // Assert
    await expect(db.selectFrom('setting').selectAll().execute()).resolves.toEqual([]);
  });
});
