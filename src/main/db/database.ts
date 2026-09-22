import type { Database } from './types.ts'
import { logger } from '../logging/logger';
import { createIncidentId } from '../logging/incident';
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
  | { name: 'RESET'; quarantinePath: string; incidentId: string }
  | { name: 'FAILED'; message: string; incidentId: string };

// Latched outcome of the last initializeDatabase() call. No consumer yet: this is the seam a later
// step reads over an `invoke` channel, once there is a renderer surface for it.
export let dbStatus: DatabaseStatus = { name: 'OK' };

async function openAndMigrate(filePath: string): Promise<void> {
  const sqlite = new SQLite(filePath);

  try {
    if (filePath !== ':memory:') {
      sqlite.pragma('journal_mode = WAL');

      // A migration only touches the migration table once the schema is up to date, so it can succeed
      // even when other tables are corrupted on disk. Checking here, inside withCorruptionRecovery's
      // guarded attempt, is what lets that corruption trigger a quarantine-and-reset instead of
      // surfacing as SQLITE_CORRUPT errors from the first real query later on.
      const integrityRows = sqlite.pragma('quick_check') as { quick_check: string }[];
      if (integrityRows.length !== 1 || integrityRows[0]?.quick_check !== 'ok') {
        throw Object.assign(
          new Error(`database disk image is malformed: ${integrityRows.map((row) => row.quick_check).join('; ')}`),
          { code: 'SQLITE_CORRUPT' },
        );
      }
    }
  } catch (error) {
    sqlite.close();
    throw error;
  }

  db = new Kysely<Database>({ dialect: new SqliteDialect({ database: sqlite }) });

  // A migration that rebuilds a table (an in-place ALTER cannot drop a column carrying a REFERENCES
  // constraint, or change a unique constraint) does so with DROP TABLE, which fires the parent's
  // cascade actions when foreign keys are enforced. Kysely runs the migrator inside a transaction,
  // where `PRAGMA foreign_keys` is a no-op, so it has to be turned off out here instead, per
  // https://www.sqlite.org/lang_altertable.html#otheralter's procedure for table rebuilds.
  sqlite.pragma('foreign_keys = OFF');

  const migrator = new Migrator({ db, provider: migrationProvider });
  const { error, results } = await migrator.migrateToLatest();

  results?.forEach((result) => {
    if (result.status === 'Error') {
      logger.error('operation.failure', { operation: 'database-migration' });
    }
  });

  if (error) {
    sqlite.pragma('foreign_keys = ON');
    throw error instanceof Error ? error : new Error(String(error));
  }

  const brokenForeignKeys = sqlite.pragma('foreign_key_check') as unknown[];
  sqlite.pragma('foreign_keys = ON');
  if (brokenForeignKeys.length > 0) {
    throw new Error(`Migration left ${brokenForeignKeys.length} broken foreign key reference(s) at "${filePath}".`);
  }
}

export function initializeDatabase(filePath: string): Promise<void> {
  dbFilePath = filePath;
  dbReady = withCorruptionRecovery(filePath, () => openAndMigrate(filePath), () => db.destroy())
    .then((quarantinePath) => {
      dbStatus = quarantinePath ? { name: 'RESET', quarantinePath, incidentId: createIncidentId() } : { name: 'OK' };
    })
    .catch((error: unknown) => {
      dbStatus = { name: 'FAILED', message: error instanceof Error ? error.message : String(error), incidentId: createIncidentId() };
      throw error;
    });
  return dbReady;
}

export async function closeDatabase(): Promise<void> {
  await db.destroy();
}
