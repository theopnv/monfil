// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { app, autoUpdater } from 'electron';
import type { AppUpdateState } from '../../shared/contracts';
import { broadcastToRenderers } from '../lib/sendToRenderer';
import { logger } from '../logging/logger';
import { resolveUpdateSource } from './update-source';

const FIRST_CHECK_DELAY_MS = 30 * 1000;
const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;

let state: AppUpdateState = { name: 'NONE' };
let firstCheckTimer: NodeJS.Timeout | undefined;
let checkTimer: NodeJS.Timeout | undefined;

function onUpdateDownloaded() {
  state = { name: 'READY_TO_INSTALL' };
  logger.info('app.update', { outcome: 'ready' });
  broadcastToRenderers('app:update-state-changed', state);
}

function onUpdateError(error: Error) {
  logger.warn('app.update', { outcome: 'failed' }, error);
}

function checkForUpdates() {
  if (state.name === 'NONE') {
    autoUpdater.checkForUpdates();
  }
}

export function getUpdateState(): AppUpdateState {
  return state;
}

/** Downloads updates in the background when this build updates itself. Store builds get updates from the Store. */
export function startAutoUpdates(): void {
  const source = resolveUpdateSource({
    platform: process.platform,
    arch: process.arch,
    version: app.getVersion(),
    isPackaged: app.isPackaged,
    isWindowsStore: process.windowsStore === true,
  });
  if (source.name !== 'FEED') {
    return;
  }

  autoUpdater.setFeedURL({ url: source.url });
  autoUpdater.on('update-downloaded', onUpdateDownloaded);
  autoUpdater.on('error', onUpdateError);

  // Squirrel's installer still holds Update.exe during the first launch after an install.
  if (!process.argv.includes('--squirrel-firstrun')) {
    firstCheckTimer = setTimeout(checkForUpdates, FIRST_CHECK_DELAY_MS);
  }
  checkTimer = setInterval(checkForUpdates, CHECK_INTERVAL_MS);
}

export function stopAutoUpdates(): void {
  clearTimeout(firstCheckTimer);
  clearInterval(checkTimer);
  firstCheckTimer = undefined;
  checkTimer = undefined;
  autoUpdater.off('update-downloaded', onUpdateDownloaded);
  autoUpdater.off('error', onUpdateError);
  state = { name: 'NONE' };
}

/** Restarts into the downloaded update. Does nothing until an update is ready. */
export function installUpdate(): void {
  if (state.name === 'READY_TO_INSTALL') {
    autoUpdater.quitAndInstall();
  }
}
