import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initialSchema from './0001_initial_schema';
import * as feedItemRead from './0002_feed_item_read';
import * as articleContent from './0003_article_content';

const migrations: Record<string, Migration> = {
  '0001_initial_schema': initialSchema,
  '0002_feed_item_read': feedItemRead,
  '0003_article_content': articleContent,
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
