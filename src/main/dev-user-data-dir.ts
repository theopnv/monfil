import path from 'node:path';

export interface DevUserDataDirInput {
  isPackaged: boolean;
  hasExplicitUserDataDir: boolean;
  appDataDir: string;
  appName: string;
}

/**
 * Decides whether an unpackaged dev run should get its own `userData` directory. The dev build and
 * the packaged release share the same app name, so without this override they resolve to the same
 * on-disk directory: developing against the database applies migrations the released build does not
 * know about, and the release then fails to open the shared file.
 * @returns the directory to switch `userData` to, or `null` to leave Electron's default untouched
 */
export function resolveDevUserDataDir({ isPackaged, hasExplicitUserDataDir, appDataDir, appName }: DevUserDataDirInput): string | null {
  if (isPackaged || hasExplicitUserDataDir) {
    return null;
  }
  return path.join(appDataDir, `${appName}-dev`);
}
