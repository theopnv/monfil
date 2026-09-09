import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { sql } from 'kysely';
import { getAppInfo } from './app-info';
import { closeDatabase, db, initializeDatabase } from './db/database';
import { addFeedToDatabase } from './db/crud/insert';

vi.mock(import('electron'), () => ({
  app: { getVersion: vi.fn(() => '1.2.3') } as unknown as Electron.App,
}));

describe('getAppInfo', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'monfil-app-info-'));
    filePath = path.join(dir, 'monfil.db');
    await initializeDatabase(filePath);
  });

  afterEach(async () => {
    await closeDatabase();
    // Windows can hold the file's OS-level lock briefly after better-sqlite3's close() returns.
    await rm(dir, { recursive: true, maxRetries: 3, retryDelay: 100 });
  });

  test('reports the app version, feed count and item count', async () => {
    // Arrange
    await addFeedToDatabase({
      link: 'https://a.example/feed',
      title: 'Feed A',
      items: [{ title: 'Item 1', link: 'https://a.example/1', guid: 'https://a.example/1', pubDate: '2024-01-01', description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
      type: 'rss',
      categoryName: 'tech',
      showInHome: true,
    });

    // Act
    const info = await getAppInfo();

    // Assert
    expect(info.version).toBe('1.2.3');
    expect(info.feedCount).toBe(1);
    expect(info.itemCount).toBe(1);
  });

  test('sums the main file and the -wal sidecar', async () => {
    // Arrange
    await writeFile(`${filePath}-wal`, Buffer.alloc(4096));

    // Act
    const info = await getAppInfo();

    // Assert
    expect(info.databaseSizeBytes).toBeGreaterThanOrEqual(4096);
  });

  test('accounts for a checkpointed -wal/-shm sidecar without throwing', async () => {
    // Arrange
    // A live WAL-mode connection keeps its -wal/-shm files open for as long as it lives, so they
    // cannot be deleted out from under it on Windows. Checkpointing truncates the -wal file instead;
    // the -shm file stays allocated at its fixed size for as long as the connection holds it open.
    await sql`PRAGMA wal_checkpoint(TRUNCATE)`.execute(db);
    const [mainStat, walStat, shmStat] = await Promise.all([
      stat(filePath),
      stat(`${filePath}-wal`),
      stat(`${filePath}-shm`),
    ]);

    // Act, Assert
    await expect(getAppInfo()).resolves.toMatchObject({
      databaseSizeBytes: mainStat.size + walStat.size + shmStat.size,
    });
  });
});
