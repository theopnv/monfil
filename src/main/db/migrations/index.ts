import type { Migration, MigrationProvider } from 'kysely/migration';
import * as initialSchema from './0001_initial_schema';
import * as feedIcon from './0002_feed_icon';
import * as riverIndex from './0003_river_index';
import * as workspaces from './0004_workspaces';
import * as placementCategoryWorkspace from './0005_placement_category_workspace';
import * as feedConditionalGet from './0006_feed_conditional_get';
import * as itemRetention from './0007_item_retention';

const migrations: Record<string, Migration> = {
  '0001_initial_schema': initialSchema,
  '0002_feed_icon': feedIcon,
  '0003_river_index': riverIndex,
  '0004_workspaces': workspaces,
  '0005_placement_category_workspace': placementCategoryWorkspace,
  '0006_feed_conditional_get': feedConditionalGet,
  '0007_item_retention': itemRetention,
};

export const migrationProvider: MigrationProvider = {
  async getMigrations() {
    return migrations;
  },
};
