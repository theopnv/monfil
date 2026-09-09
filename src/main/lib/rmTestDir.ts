import { rm } from 'node:fs/promises';

/**
 * Best-effort removal of a test's temp directory. Windows can hold a just-closed SQLite file's lock
 * for an unbounded time (observed: still locked after 20s of retries), most likely background
 * antivirus scanning catching up on a burst of file churn. Either way the directory lives under the
 * OS temp dir, so a failed removal here is not a real leak: CI throws the whole runner away after the
 * job, and the OS reclaims local temp directories on its own.
 * @param dir the temp directory to remove
 */
export async function rmTestDir(dir: string): Promise<void> {
  try {
    await rm(dir, { recursive: true, maxRetries: 5, retryDelay: 200 });
  } catch (error) {
    console.warn(`Could not remove temp test directory "${dir}".`, error);
  }
}
