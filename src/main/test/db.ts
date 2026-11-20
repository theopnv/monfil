// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll } from 'vitest';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';
import { db, initializeDatabase } from '../db/database';

/** Empties every table, and keeps the Home workspace that every migrated database has. */
export async function resetDatabase(): Promise<void> {
  await db.deleteFrom('articleContent').execute();
  await db.deleteFrom('savedItem').execute();
  await db.deleteFrom('undatedItem').execute();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedPlacement').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
  await db.deleteFrom('savedSearch').execute();
  await db.deleteFrom('setting').execute();
  await db.deleteFrom('usage_counter').execute();
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
  await db.updateTable('workspace').set({ search_hint_dismissed_at: null }).execute();
}

/** Opens one in-memory database for the test file, and resets it after each test. */
export function useTestDatabase(): void {
  beforeAll(async () => {
    await initializeDatabase(':memory:');
  });
  afterEach(resetDatabase);
}
