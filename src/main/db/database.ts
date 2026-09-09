import type { Database } from './types.ts'
import SQLite from 'better-sqlite3'
import { Kysely, SqliteDialect } from 'kysely'
import { Migrator } from 'kysely/migration'
import { migrationProvider } from './migrations/index.ts'
import { withCorruptionRecovery } from './recovery.ts'

// Populated by initializeDatabase().
// Every consumer's contract is "await dbReady, then use db", so nothing reads these before initializeDatabase has run.
export let db!: Kysely<Database>;
export let dbReady!: Promise<void>;
export let dbFilePath!: string;

export type DatabaseStatus =
  | { name: 'OK' }
  | { name: 'RESET'; quarantinePath: string }
  | { name: 'FAILED'; message: string };

// Latched outcome of the last initializeDatabase() call. No consumer yet: this is the seam a later
// step reads over an `invoke` channel, once there is a renderer surface for it.
export let dbStatus: DatabaseStatus = { name: 'OK' };

async function openAndMigrate(filePath: string): Promise<void> {
  const sqlite = new SQLite(filePath);

  try {
    // Declared via .references(...) in the migration but not enforced bySQLite unless this pragma is set, per connection, every time.
    sqlite.pragma('foreign_keys = ON');

    if (filePath !== ':memory:') {
      sqlite.pragma('journal_mode = WAL');
    }
  } catch (error) {
    // Kysely only initializes its driver (and so only closes this handle via db.destroy()) once a
    // query has run through it, which hasn't happened yet here. Close the raw handle directly, or
    // withCorruptionRecovery's quarantine rename fails on Windows, which cannot rename an open file.
    sqlite.close();
    throw error;
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
}

export function initializeDatabase(filePath: string): Promise<void> {
  dbFilePath = filePath;
  dbReady = withCorruptionRecovery(filePath, () => openAndMigrate(filePath), () => db.destroy())
    .then((quarantinePath) => {
      dbStatus = quarantinePath ? { name: 'RESET', quarantinePath } : { name: 'OK' };
    })
    .catch((error: unknown) => {
      dbStatus = { name: 'FAILED', message: error instanceof Error ? error.message : String(error) };
      throw error;
    });
  return dbReady;
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
