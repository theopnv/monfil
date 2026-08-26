import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initialSchema from './0001_initial_schema';
import * as feedItemRead from './0002_feed_item_read';
import * as articleContent from './0003_article_content';
import * as feedItemIdentity from './0004_feed_item_identity';
import * as feedSourceType from './0005_feed_source_type';

const migrations: Record<string, Migration> = {
  '0001_initial_schema': initialSchema,
  '0002_feed_item_read': feedItemRead,
  '0003_article_content': articleContent,
  '0004_feed_item_identity': feedItemIdentity,
  '0005_feed_source_type': feedSourceType,
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
