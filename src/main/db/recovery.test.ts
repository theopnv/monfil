import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { existsSync, renameSync } from 'node:fs';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { withCorruptionRecovery } from './recovery';

vi.mock(import('node:fs'), async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, renameSync: vi.fn(actual.renameSync) };
});

const mockedRenameSync = vi.mocked(renameSync);

function corruptionError(): Error {
  return Object.assign(new Error('file is not a database'), { code: 'SQLITE_CORRUPT' });
}

function ioError(): Error {
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
    mockedRenameSync.mockClear();
    // Windows can hold the file's OS-level lock briefly after better-sqlite3's close() returns.
    await rm(dir, { recursive: true, maxRetries: 10, retryDelay: 200 });
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

  test('closes, quarantines the database files, and retries once on a corruption-shaped error', async () => {
    // Arrange
    await writeFile(filePath, 'garbage');
    await writeFile(`${filePath}-wal`, 'garbage wal');
    const attempt = vi.fn().mockRejectedValueOnce(corruptionError()).mockResolvedValueOnce(undefined);
    const close = vi.fn().mockResolvedValue(undefined);

    // Act
    const result = await withCorruptionRecovery(filePath, attempt, close);

    // Assert
    expect(close).toHaveBeenCalledTimes(1);
    expect(attempt).toHaveBeenCalledTimes(2);
    expect(existsSync(filePath)).toBe(false);
    expect(existsSync(`${filePath}-wal`)).toBe(false);
    if (result === null) {
      throw new Error('expected the database to be quarantined');
    }
    expect(result).toMatch(/\.corrupt-/);
    await expect(readFile(result, 'utf-8')).resolves.toBe('garbage');
    await expect(readFile(`${result}-wal`, 'utf-8')).resolves.toBe('garbage wal');
  });

  test('rethrows an I/O error without quarantining, since it does not mean the data is gone', async () => {
    // Arrange
    await writeFile(filePath, 'a real-enough db file');
    const error = ioError();
    const attempt = vi.fn().mockRejectedValue(error);

    // Act
    // Assert
    await expect(withCorruptionRecovery(filePath, attempt, vi.fn())).rejects.toBe(error);
    expect(attempt).toHaveBeenCalledTimes(1);
    expect(existsSync(filePath)).toBe(true);
  });

  test('rethrows the original corruption error, not a rename failure, when quarantining itself fails', async () => {
    // Arrange
    await writeFile(filePath, 'garbage');
    const error = corruptionError();
    const attempt = vi.fn().mockRejectedValue(error);
    mockedRenameSync.mockImplementationOnce(() => {
      throw new Error('EACCES: permission denied');
    });

    // Act
    // Assert
    await expect(withCorruptionRecovery(filePath, attempt, vi.fn())).rejects.toBe(error);
    expect(attempt).toHaveBeenCalledTimes(1);
  });

  test('still retries when close itself throws, since a connection that never opened has nothing to release', async () => {
    // Arrange
    const attempt = vi.fn().mockRejectedValueOnce(corruptionError()).mockResolvedValueOnce(undefined);
    const close = vi.fn().mockRejectedValue(new Error('nothing to close'));

    // Act
    // Assert
    await expect(withCorruptionRecovery(filePath, attempt, close)).resolves.toEqual(expect.any(String));
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
