import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withCorruptionRecovery } from './recovery';

function corruptionError(): Error {
  return Object.assign(new Error('disk I/O error'), { code: 'SQLITE_IOERR_SHORT_READ' });
}

describe('withCorruptionRecovery', () => {
  let dir: string;
  let filePath: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), 'monfil-recovery-'));
    filePath = path.join(dir, 'monfil.db');
  });

  afterEach(async () => {
    await rm(dir, { recursive: true });
  });

  test('runs attempt once and resolves when it succeeds', async () => {
    // Arrange
    const attempt = vi.fn().mockResolvedValue(undefined);
    const close = vi.fn();

    // Act
    await withCorruptionRecovery(filePath, attempt, close);

    // Assert
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
  });

  test('re-throws an error that is not corruption-shaped, without retrying', async () => {
    // Arrange
    const error = new Error('some other failure');
    const attempt = vi.fn().mockRejectedValue(error);

    // Act
    // Assert
    await expect(withCorruptionRecovery(filePath, attempt, vi.fn())).rejects.toBe(error);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  test('skips recovery for :memory:, even on a corruption-shaped error', async () => {
    // Arrange
    const error = corruptionError();
    const attempt = vi.fn().mockRejectedValue(error);

    // Act
    // Assert
    await expect(withCorruptionRecovery(':memory:', attempt, vi.fn())).rejects.toBe(error);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  test('closes, deletes the database files, and retries once on a corruption-shaped error', async () => {
    // Arrange
    await writeFile(filePath, 'garbage');
    await writeFile(`${filePath}-wal`, 'garbage');
    const attempt = vi.fn().mockRejectedValueOnce(corruptionError()).mockResolvedValueOnce(undefined);
    const close = vi.fn().mockResolvedValue(undefined);

    // Act
    await withCorruptionRecovery(filePath, attempt, close);

    // Assert
    expect(close).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(`${filePath}-wal`)).toBe(false);
  });

  test('still retries when close itself throws, since a connection that never opened has nothing to release', async () => {
    // Arrange
    const attempt = vi.fn().mockRejectedValueOnce(corruptionError()).mockResolvedValueOnce(undefined);
    const close = vi.fn().mockRejectedValue(new Error('nothing to close'));

    // Act
    // Assert
    await expect(withCorruptionRecovery(filePath, attempt, close)).resolves.toBeUndefined();
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  test('propagates a second failure instead of retrying forever', async () => {
    // Arrange
    const secondError = corruptionError();
    const attempt = vi.fn().mockRejectedValueOnce(corruptionError()).mockRejectedValueOnce(secondError);

    // Act
    // Assert
    await expect(withCorruptionRecovery(filePath, attempt, vi.fn())).rejects.toBe(secondError);
    expect(attempt).toHaveBeenCalledTimes(2);
  });

  test('removes leftover WAL/SHM/journal files before the first attempt when the main file is missing', async () => {
    // Arrange
    await writeFile(`${filePath}-wal`, 'stale');
    await writeFile(`${filePath}-shm`, 'stale');
    await writeFile(`${filePath}-journal`, 'stale');
    const attempt = vi.fn(async () => {
      expect(existsSync(`${filePath}-wal`)).toBe(false);
      expect(existsSync(`${filePath}-shm`)).toBe(false);
      expect(existsSync(`${filePath}-journal`)).toBe(false);
    });

    // Act
    await withCorruptionRecovery(filePath, attempt, vi.fn());

    // Assert
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  test('leaves sidecar files alone when the main database file is present', async () => {
    // Arrange
    await writeFile(filePath, 'a real-enough db file');
    await writeFile(`${filePath}-wal`, 'in-progress wal');
    const attempt = vi.fn().mockResolvedValue(undefined);

    // Act
    await withCorruptionRecovery(filePath, attempt, vi.fn());

    // Assert
    expect(existsSync(`${filePath}-wal`)).toBe(true);
  });
});
