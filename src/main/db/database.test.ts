// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, beforeEach } from 'vitest';
import { existsSync, statSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import SQLite from 'better-sqlite3';
import { sql } from 'kysely';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';
import { backUpDatabase, closeDatabase, db, dbReady, dbStatus, initializeDatabase, vacuumDatabase } from './database';
import { rmTestDir } from '../lib/rmTestDir';

describe('initializeDatabase', () => {
  beforeEach(async () => {
    await initializeDatabase(':memory:');
  });

  afterEach(async () => {
    await closeDatabase();
  });

  test('creates the current database tables', async () => {
    // Act
    const tables = await db.introspection.getTables();

    // Assert
    expect(tables.map((table) => table.name).sort()).toEqual([
      'articleContent', 'feedCategory', 'feedItem', 'feedMetadata', 'feedPlacement', 'savedItem', 'savedSearch', 'setting', 'undatedItem', 'workspace',
    ]);
  });

  test('defines the columns the query and insert layers rely on', async () => {
    // Act
    const tables = await db.introspection.getTables();
    const columnsOf = (tableName: string) =>
      tables.find((table) => table.name === tableName)?.columns.map((column) => column.name).sort();

    // Assert
    expect(columnsOf('workspace')).toEqual(['color', 'icon', 'id', 'installed_at', 'name', 'position', 'search_hint_dismissed_at', 'source_slug', 'source_version']);
    expect(columnsOf('feedCategory')).toEqual(['id', 'name', 'workspace_id']);
    expect(columnsOf('feedMetadata')).toEqual(['etag', 'icon', 'id', 'last_error', 'last_fetched_at', 'last_modified', 'link', 'title', 'type']);
    expect(columnsOf('feedPlacement')).toEqual(['category_id', 'feed_id', 'showInWorkspace', 'workspace_id']);
    expect(columnsOf('feedItem')).toEqual(['author', 'description', 'excerpt', 'extra', 'feed_id', 'guid', 'id', 'image', 'link', 'pubDate', 'published_at', 'read_at', 'title']);
    expect(columnsOf('undatedItem')).toEqual(['feed_id', 'first_fetched_at', 'guid']);
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

  test('creates a consistent backup before a pending migration', async () => {
    // Arrange
    await closeDatabase();
    const old = new SQLite(filePath);
    old.pragma('journal_mode = WAL');
    old.exec("DROP TABLE savedSearch; ALTER TABLE workspace DROP COLUMN search_hint_dismissed_at; DELETE FROM kysely_migration WHERE name = '0009_saved_search'; INSERT INTO setting (key, value) VALUES ('wal-row', 'present')");

    // Act
    await initializeDatabase(filePath);
    const backups = (await readdir(dir)).filter((name) => name.includes('.migration-'));
    const backup = new SQLite(path.join(dir, backups[0] ?? ''), { readonly: true });

    // Assert
    expect(backups).toHaveLength(1);
    expect(backup.prepare("SELECT value FROM setting WHERE key = 'wal-row'").get()).toEqual({ value: 'present' });
    expect(backup.prepare("SELECT name FROM kysely_migration WHERE name = '0009_saved_search'").get()).toBeUndefined();
    backup.close();
    old.close();
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

  // A damaged index page makes quick_check return a report row instead of throwing, so the schema
  // still opens and only the explicit integrity check can notice.
  test('quarantines a file whose quick_check reports damage and reports the reset', async () => {
    // Arrange
    await initializeDatabase(filePath);
    await db.insertInto('setting').values({ key: 'theme', value: 'dark' }).execute();
    await closeDatabase();

    const probe = new SQLite(filePath);
    const pageSize = probe.pragma('page_size', { simple: true }) as number;
    const { rootpage } = probe.prepare("SELECT rootpage FROM sqlite_master WHERE type = 'index' AND name NOT LIKE 'sqlite_autoindex%'").get() as { rootpage: number };
    probe.close();

    const bytes = await readFile(filePath);
    const pageStart = (rootpage - 1) * pageSize;
    bytes.subarray(pageStart, pageStart + pageSize).fill(0xff);
    await writeFile(filePath, bytes);

    // Act
    await initializeDatabase(filePath);
    const files = await readdir(dir);

    // Assert
    expect(dbStatus).toEqual({ name: 'RESET', quarantinePath: expect.stringContaining(`${filePath}.corrupt-`), incidentId: expect.any(String) });
    expect(files.filter((name) => name.startsWith('monfil.db.corrupt-'))).toEqual([path.basename((dbStatus as { quarantinePath: string }).quarantinePath)]);
    await expect(db.selectFrom('setting').selectAll().execute()).resolves.toEqual([]);
  });
});

describe('failing to open a file database', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'monfil-db-'));
    filePath = path.join(dir, 'monfil.db');
    await initializeDatabase(filePath);
    await closeDatabase();
  });

  afterEach(async () => {
    await closeDatabase();
    await rmTestDir(dir);
  });

  test('rejects, reports FAILED, and releases the file when a pending migration cannot apply', async () => {
    // Arrange
    const old = new SQLite(filePath);
    old.exec("DELETE FROM kysely_migration WHERE name = '0008_saved_items'");
    old.close();

    // Act
    const opening = initializeDatabase(filePath);

    // Assert
    await expect(opening).rejects.toThrow(/already exists/);
    expect(dbStatus).toEqual({ name: 'FAILED', message: expect.stringContaining('already exists'), incidentId: expect.any(String) });
    expect(existsSync(`${filePath}-wal`)).toBe(false);
  });

  test('rejects when the file holds a foreign key reference to a missing row', async () => {
    // Arrange
    const old = new SQLite(filePath);
    old.pragma('foreign_keys = OFF');
    old.exec("INSERT INTO feedCategory (name, workspace_id) VALUES ('orphan', 999)");
    old.close();

    // Act
    const opening = initializeDatabase(filePath);

    // Assert
    await expect(opening).rejects.toThrow(`Migration left 1 broken foreign key reference(s) at "${filePath}".`);
    expect(dbStatus.name).toBe('FAILED');
    expect(existsSync(`${filePath}-wal`)).toBe(false);
  });

  test('reports OK again after a later successful initialization', async () => {
    // Arrange
    const old = new SQLite(filePath);
    old.exec("DELETE FROM kysely_migration WHERE name = '0008_saved_items'");
    old.close();
    await initializeDatabase(filePath).catch(() => undefined);

    // Act
    await initializeDatabase(':memory:');

    // Assert
    expect(dbStatus).toEqual({ name: 'OK' });
  });
});

describe('closing and maintaining a file database', () => {
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

  test('closing empties the write-ahead log even while another connection keeps the file open', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'theme', value: 'dark' }).execute();
    const other = new SQLite(filePath);
    other.prepare('SELECT count(*) FROM setting').get();

    // Act
    await closeDatabase();

    // Assert
    expect(statSync(`${filePath}-wal`).size).toBe(0);
    other.close();
  });

  test('vacuum returns the freed pages to the main file', async () => {
    // Arrange
    const blob = 'x'.repeat(10_000);
    await db.insertInto('setting').values(Array.from({ length: 200 }, (_, index) => ({ key: `k${index}`, value: blob }))).execute();
    await db.deleteFrom('setting').execute();
    await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(db);
    const sizeBefore = statSync(filePath).size;

    // Act
    vacuumDatabase();

    // Assert
    expect(statSync(filePath).size).toBeLessThan(sizeBefore / 2);
    expect(statSync(`${filePath}-wal`).size).toBe(0);
  });

  test('vacuum does nothing once the database is closed', async () => {
    // Arrange
    await closeDatabase();

    // Act
    // Assert
    expect(() => vacuumDatabase()).not.toThrow();
  });

  test('a backup request fails once the database is closed', async () => {
    // Arrange
    await closeDatabase();

    // Act
    // Assert
    await expect(backUpDatabase(path.join(dir, 'copy.db'))).rejects.toThrow('Database is closed');
  });

  test('a failing backup rethrows the original error when no partial file exists', async () => {
    // Arrange
    const destination = path.join(dir, 'missing-folder', 'copy.db');

    // Act
    // Assert
    await expect(backUpDatabase(destination)).rejects.toMatchObject({ code: 'SQLITE_CANTOPEN' });
  });

  test('a backup whose final rename fails leaves no partial file behind', async () => {
    // Arrange
    const destination = path.join(dir, 'taken');
    await mkdir(destination);
    await writeFile(path.join(destination, 'keep.txt'), 'x');

    // Act
    await expect(backUpDatabase(destination)).rejects.toThrow();

    // Assert
    expect((await readdir(dir)).filter((name) => name.includes('.partial-'))).toEqual([]);
  });
});
