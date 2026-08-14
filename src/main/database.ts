import type { Database } from './db/types.ts'
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { Migrator } from 'kysely/migration'
import { migrationProvider } from './db/migrations'

export const DB_FILE_NAME = 'monfil.db';

// Populated by initializeDatabase().
// Every consumer's contract is "await dbReady, then use db" (see doc/database.md), so nothing reads these before initializeDatabase has run.
export let db!: Kysely<Database>;
export let dbReady!: Promise<void>;

export function initializeDatabase(filePath: string): Promise<void> {
  dbReady = (async () => {
    const sqlite = new SQLite(filePath);

    // Declared via .references(...) in the migration but not enforced bySQLite unless this pragma is set, per connection, every time.
    sqlite.pragma('foreign_keys = ON');

    if (filePath !== ':memory:') {
      sqlite.pragma('journal_mode = WAL');
    }

    db = new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });

    const migrator = new Migrator({ db, provider: migrationProvider });
    const { error, results } = await migrator.migrateToLatest();

    results?.forEach((result) => {
      if (result.status === 'Error') {
        console.error(`Migration "${result.migrationName}" failed.`);
      }
    });

    if (error) {
      throw error instanceof Error ? error : new Error(String(error));
    }
  })();

  return dbReady;
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
