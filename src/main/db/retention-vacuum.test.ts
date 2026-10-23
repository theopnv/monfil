// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import { statSync } from 'node:fs';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';
import { rmTestDir } from '../lib/rmTestDir';
import { addFeedToDatabase } from './crud/insert';
import { closeDatabase, db, initializeDatabase } from './database';
import { pruneExpiredItems } from './retention';

describe('pruneExpiredItems on a file database', () => {
  const now = Date.parse('2026-09-23T12:00:00Z');
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'monfil-retention-'));
    filePath = path.join(dir, 'monfil.db');
    await initializeDatabase(filePath);
  });

  afterEach(async () => {
    await closeDatabase();
    await rmTestDir(dir);
  });

  // Ten items per source are always kept, so a batch of `expired + 10` old items removes `expired` rows.
  async function seedOldItems(expired: number): Promise<void> {
    const feed = await addFeedToDatabase({ link: 'https://large.example/feed', title: 'Large', type: 'rss', items: [], categoryName: 'Large', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true });
    if (!feed.success) {
      throw new Error('feed insert failed');
    }
    await db.insertInto('feedItem').values(Array.from({ length: expired + 10 }, (_, index) => ({
      feed_id: feed.data.id, guid: String(index), title: 'Old', pubDate: '2020-01-01', description: 'x'.repeat(1_000), published_at: Date.parse('2020-01-01') + index,
    }))).execute();
    await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(db);
  }

  test.each([1_000, 1_001])('compacts the file after removing %i items', async (expired) => {
    // Arrange
    await seedOldItems(expired);
    const sizeBefore = statSync(filePath).size;

    // Act
    const removed = await pruneExpiredItems(30, now);

    // Assert
    expect(removed).toBe(expired);
    expect(statSync(filePath).size).toBeLessThan(sizeBefore / 2);
  });

  test('leaves the file as it is after removing fewer than 1000 items', async () => {
    // Arrange
    await seedOldItems(999);
    const sizeBefore = statSync(filePath).size;

    // Act
    const removed = await pruneExpiredItems(30, now);

    // Assert
    expect(removed).toBe(999);
    expect(statSync(filePath).size).toBeGreaterThanOrEqual(sizeBefore);
  });
});
