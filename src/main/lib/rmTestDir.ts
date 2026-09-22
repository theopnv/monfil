import { rm } from 'node:fs/promises';
import { logger } from '../logging/logger';

const CLEANUP_TIMEOUT_MS = 5000;

/**
 * Best-effort removal of a test's temp directory, bounded by a hard timeout. Windows can leave
 * fs.rm() hanging indefinitely instead of ever settling (observed: still pending after 20s), most
 * likely a stuck antivirus filter driver, so this races it against a timer rather than trusting it to
 * resolve or reject on its own. Either way the directory lives under the OS temp dir, so leaving it
 * behind is not a real leak: CI throws the whole runner away after the job, and the OS reclaims local
 * temp directories on its own.
 * @param dir the temp directory to remove
 */
export async function rmTestDir(dir: string): Promise<void> {
  await new Promise<void>((resolve) => {
    const timer = setTimeout(() => {
      logger.warn('operation.failure', { operation: 'remove-test-directory-timeout' });
      resolve();
    }, CLEANUP_TIMEOUT_MS);
    timer.unref();

    rm(dir, { recursive: true, maxRetries: 3, retryDelay: 200 })
      .catch((error: unknown) => {
        logger.warn('operation.failure', { operation: 'remove-test-directory' }, error);
      })
      .finally(() => {
        clearTimeout(timer);
        resolve();
      });
  });
}
