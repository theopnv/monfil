import { afterEach, expect, test } from 'vitest';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import SQLite from 'better-sqlite3';
import { backUpBeforeMigration, createBackup } from './backup';
import { backUpDatabase, closeDatabase, db, initializeDatabase } from './database';

const dirs: string[] = [];
afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('backs up WAL data and keeps two migration copies', () => {
  // Arrange
  const dir = mkdtempSync(path.join(tmpdir(), 'monfil-backup-'));
  dirs.push(dir);
  const filePath = path.join(dir, 'monfil.db');
  const source = new SQLite(filePath);
  source.pragma('journal_mode = WAL');
  source.exec('CREATE TABLE item (value TEXT)');
  source.prepare('INSERT INTO item (value) VALUES (?)').run('from WAL');

  // Act
  const paths = [backUpBeforeMigration(source, filePath), backUpBeforeMigration(source, filePath), backUpBeforeMigration(source, filePath)];
  const backup = new SQLite(paths[2], { readonly: true });

  // Assert
  expect(backup.prepare('SELECT value FROM item').get()).toEqual({ value: 'from WAL' });
  expect(readdirSync(dir).filter((name) => name.includes('.migration-'))).toHaveLength(2);
  backup.close();
  source.close();
});

test('manual copy opens and backup errors reach the caller', () => {
  // Arrange
  const dir = mkdtempSync(path.join(tmpdir(), 'monfil-backup-'));
  dirs.push(dir);
  const source = new SQLite(path.join(dir, 'source.db'));
  source.exec('CREATE TABLE item (value INTEGER); INSERT INTO item VALUES (42)');

  // Act
  const destination = path.join(dir, 'copy.db');
  createBackup(source, destination);
  const copy = new SQLite(destination, { readonly: true });

  // Assert
  expect(copy.prepare('SELECT value FROM item').get()).toEqual({ value: 42 });
  expect(() => createBackup(source, destination)).toThrow();
  copy.close();
  source.close();
});

test('manual backup includes live database rows', async () => {
  // Arrange
  const dir = mkdtempSync(path.join(tmpdir(), 'monfil-backup-'));
  dirs.push(dir);
  await initializeDatabase(path.join(dir, 'source.db'));
  await db.insertInto('setting').values({ key: 'live', value: 'yes' }).execute();
  const destination = path.join(dir, 'manual.db');

  // Act
  await backUpDatabase(destination);
  const copy = new SQLite(destination, { readonly: true });

  // Assert
  expect(copy.prepare("SELECT value FROM setting WHERE key = 'live'").get()).toEqual({ value: 'yes' });
  copy.close();
  await closeDatabase();
});
