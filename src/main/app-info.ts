import { stat } from 'node:fs/promises';
import { app } from 'electron';
import { dbFilePath } from './db/database';
import { countFeedItems, countFeedMetadata } from './db/crud/query';

export interface AppInfo {
  version: string;
  feedCount: number;
  itemCount: number;
  databaseSizeBytes: number;
}

async function sizeOf(filePath: string): Promise<number> {
  try {
    return (await stat(filePath)).size;
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return 0;
    }
    throw error;
  }
}

/**
 * Gathers the figures shown on the Settings "Your data" card. Database size sums `monfil.db` and its
 * `-wal` / `-shm` sidecars, since WAL mode can hold a large share of the data outside the main file.
 */
export async function getAppInfo(): Promise<AppInfo> {
  const [feedCount, itemCount, mainSize, walSize, shmSize] = await Promise.all([
    countFeedMetadata(),
    countFeedItems(),
    sizeOf(dbFilePath),
    sizeOf(`${dbFilePath}-wal`),
    sizeOf(`${dbFilePath}-shm`),
  ]);

  return {
    version: app.getVersion(),
    feedCount,
    itemCount,
    databaseSizeBytes: mainSize + walSize + shmSize,
  };
}
