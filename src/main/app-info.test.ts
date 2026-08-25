import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { getAppInfo } from './app-info';
import { closeDatabase, initializeDatabase } from './db/database';
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
    await rm(dir, { recursive: true });
  });

  test('reports the app version, feed count and item count', async () => {
    // Arrange
    await addFeedToDatabase({
      link: 'https://a.example/feed',
      title: 'Feed A',
      items: [{ title: 'Item 1', link: 'https://a.example/1', pubDate: '2024-01-01', description: '', image: undefined, read_at: undefined }],
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

  test('treats a missing -wal/-shm sidecar as zero bytes rather than throwing', async () => {
    // Arrange
    await rm(`${filePath}-wal`, { force: true });
    await rm(`${filePath}-shm`, { force: true });

    // Act, Assert
    await expect(getAppInfo()).resolves.toMatchObject({ feedCount: 0, itemCount: 0 });
  });
});
