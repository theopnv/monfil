import { existsSync, renameSync, rmSync } from 'node:fs';

// WAL mode keeps uncommitted pages in these sidecar files. Deleting only the main file (e.g. to reset a
// dev database by hand) leaves them behind pointing at a database that no longer exists, which SQLite
// reports as a generic disk I/O error rather than "file not found".
function sidecarFilesOf(filePath: string): string[] {
  return [`${filePath}-wal`, `${filePath}-shm`, `${filePath}-journal`];
}

// `SQLITE_IOERR*` (full disk, a locked file, a dropped network volume, a permission change) is
// deliberately excluded: none of those mean the data is gone, so none of them should trigger a reset.
function isCorruptionError(error: unknown): boolean {
  if (!(error instanceof Error) || !('code' in error)) {
    return false;
  }
  const code = String(error.code);
  return code.startsWith('SQLITE_CORRUPT') || code === 'SQLITE_NOTADB';
}

/**
 * Runs `attempt` against a file-backed database, recovering once from a database file that has gone
 * missing or corrupted underneath SQLite: leftover WAL/SHM/journal sidecars pointing at a database that
 * no longer exists, or a main file that is present but unreadable because it is corrupt
 * (`SQLITE_CORRUPT*`) or not a database at all (`SQLITE_NOTADB`). Any other I/O error (full disk, a
 * locked file, a dropped network volume, a permission change) is rethrown unchanged, since none of
 * those mean the data itself is gone. `close` releases the failed connection before the retry; its own
 * failure is ignored, since a connection that never opened has nothing to release. `:memory:` databases
 * skip recovery entirely, since there is no file for any of this to happen to.
 *
 * A reset does not delete the corrupt file: it renames the main file and every existing sidecar aside to
 * a parallel `.corrupt-<timestamp>` path, so a later manual recovery can still open them.
 * @param filePath the database file to open, or `:memory:`
 * @param attempt opens the connection and brings the schema up to date
 * @param close releases the connection left behind by a failed `attempt`
 * @returns the quarantine path if a reset happened, `null` otherwise
 */
export async function withCorruptionRecovery(filePath: string, attempt: () => Promise<void>, close: () => Promise<void>): Promise<string | null> {
  if (filePath === ':memory:') {
    await attempt();
    return null;
  }

  if (!existsSync(filePath) && sidecarFilesOf(filePath).some(existsSync)) {
    console.error(`Found leftover WAL files for a missing database at "${filePath}". Removing them before starting fresh.`);
    sidecarFilesOf(filePath).forEach((sidecar) => rmSync(sidecar, { force: true }));
  }

  try {
    await attempt();
    return null;
  } catch (error) {
    if (!isCorruptionError(error)) {
      throw error;
    }

    console.error(`Database at "${filePath}" could not be opened and looks corrupted. Quarantining it and starting fresh.`, error);
    try {
      await close();
    } catch {
      // Nothing to release if the connection never opened.
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = `${filePath}.corrupt-${stamp}`;
    try {
      [filePath, ...sidecarFilesOf(filePath)].forEach((source) => {
        if (existsSync(source)) {
          renameSync(source, source.replace(filePath, quarantinePath));
        }
      });
    } catch {
      throw error;
    }

    await attempt();
    return quarantinePath;
  }
}
