// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export const UPDATE_FEED_HOST = 'https://update.electronjs.org/theopnv/monfil';

// Electron has no updater for Linux packages.
const FEED_PLATFORMS: ReadonlySet<NodeJS.Platform> = new Set(['win32', 'darwin']);

export interface UpdateEnvironment {
  platform: NodeJS.Platform;
  arch: string;
  version: string;
  isPackaged: boolean;
  isWindowsStore: boolean;
}

export type UpdateSource =
  | { name: 'FEED'; url: string }
  | { name: 'STORE' }
  | { name: 'NONE'; reason: 'DEVELOPMENT' | 'UNSUPPORTED_PLATFORM' };

/** Picks who delivers updates to this copy of the app. */
export function resolveUpdateSource(environment: UpdateEnvironment): UpdateSource {
  if (!environment.isPackaged) {
    return { name: 'NONE', reason: 'DEVELOPMENT' };
  }
  if (environment.isWindowsStore) {
    return { name: 'STORE' };
  }
  if (!FEED_PLATFORMS.has(environment.platform)) {
    return { name: 'NONE', reason: 'UNSUPPORTED_PLATFORM' };
  }
  return {
    name: 'FEED',
    url: `${UPDATE_FEED_HOST}/${environment.platform}-${environment.arch}/${environment.version}`,
  };
}
