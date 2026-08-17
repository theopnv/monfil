import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initialSchema from './0001_initial_schema';
import * as setting from './0002_setting';

const migrations: Record<string, Migration> = {
  '0001_initial_schema': initialSchema,
  '0002_setting': setting,
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
