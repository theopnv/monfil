// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { Selectable } from 'kysely';
import { expectTypeOf, test } from 'vitest';
import type { FeedCategory, FeedMetadata, Workspace } from '../../shared/contracts';
import type { FeedCategoryTable, FeedMetadataTable, WorkspaceTable } from './types';

test('database rows implement shared contracts', () => {
  expectTypeOf<Selectable<WorkspaceTable>>().toExtend<Workspace>();
  expectTypeOf<Selectable<FeedCategoryTable>>().toExtend<FeedCategory>();
  expectTypeOf<Selectable<FeedMetadataTable>>().toExtend<FeedMetadata>();
});
