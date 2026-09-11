import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initialSchema from './0001_initial_schema';

const migrations: Record<string, Migration> = {
  '0001_initial_schema': initialSchema,
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
