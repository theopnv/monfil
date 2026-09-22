import type { Selectable } from 'kysely';
import { expectTypeOf, test } from 'vitest';
import type { FeedCategory, FeedMetadata, Workspace } from '../../shared/contracts';
import type { FeedCategoryTable, FeedMetadataTable, WorkspaceTable } from './types';

test('database rows implement shared contracts', () => {
  expectTypeOf<Selectable<WorkspaceTable>>().toExtend<Workspace>();
  expectTypeOf<Selectable<FeedCategoryTable>>().toExtend<FeedCategory>();
  expectTypeOf<Selectable<FeedMetadataTable>>().toExtend<FeedMetadata>();
});
