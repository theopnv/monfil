import { readdirSync, unlinkSync } from 'node:fs';
import path from 'node:path';
import type SQLite from 'better-sqlite3';

export function createBackup(sqlite: SQLite.Database, destination: string): void {
  sqlite.prepare('VACUUM INTO ?').run(destination);
}

export function backUpBeforeMigration(sqlite: SQLite.Database, filePath: string): string {
  const directory = path.dirname(filePath);
  const prefix = `${path.basename(filePath)}.migration-`;
  const destination = path.join(directory, `${prefix}${new Date().toISOString().replaceAll(':', '-')}-${process.hrtime.bigint()}.db`);
  createBackup(sqlite, destination);
  const backups = readdirSync(directory).filter((name) => name.startsWith(prefix) && name.endsWith('.db')).sort().reverse();
  for (const old of backups.slice(2)) {
    unlinkSync(path.join(directory, old));
  }
  return destination;
}
