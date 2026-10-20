// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import { getUpdateState, installUpdate, startAutoUpdates, stopAutoUpdates } from './auto-updater';

const { mockAutoUpdater } = await vi.hoisted(async () => {
  const { EventEmitter } = await import('node:events');
  return {
    mockAutoUpdater: Object.assign(new EventEmitter(), {
      setFeedURL: vi.fn(),
      checkForUpdates: vi.fn(),
      quitAndInstall: vi.fn(),
    }),
  };
});

vi.mock(import('electron'), () => ({
  app: {
    getVersion: () => '1.2.3',
    isPackaged: true,
  } as unknown as Electron.App,
  autoUpdater: mockAutoUpdater as unknown as Electron.AutoUpdater,
}));
vi.mock(import('../ipc/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));

const mockedBroadcast = vi.mocked(broadcastToRenderers);
const MINUTE = 60 * 1000;

const originalPlatform = process.platform;
const originalArch = process.arch;
const originalArgv = process.argv;

function runAs({ platform = 'win32', windowsStore = false, argv = ['monfil.exe'] }: { platform?: NodeJS.Platform; windowsStore?: boolean; argv?: string[] }) {
  Object.defineProperty(process, 'platform', { value: platform, configurable: true });
  Object.defineProperty(process, 'arch', { value: 'x64', configurable: true });
  Object.defineProperty(process, 'windowsStore', { value: windowsStore, configurable: true });
  process.argv = argv;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  stopAutoUpdates();
  vi.useRealTimers();
  Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
  Object.defineProperty(process, 'arch', { value: originalArch, configurable: true });
  Reflect.deleteProperty(process, 'windowsStore');
  process.argv = originalArgv;
  mockAutoUpdater.setFeedURL.mockReset();
  mockAutoUpdater.checkForUpdates.mockReset();
  mockAutoUpdater.quitAndInstall.mockReset();
  mockedBroadcast.mockReset();
});

describe('startAutoUpdates', () => {
  test('checks the release feed shortly after launch', () => {
    // Arrange
    runAs({});

    // Act
    startAutoUpdates();
    vi.advanceTimersByTime(MINUTE);

    // Assert
    expect(mockAutoUpdater.setFeedURL).toHaveBeenCalledWith({ url: 'https://update.electronjs.org/theopnv/monfil/win32-x64/1.2.3' });
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  test('waits for the periodic check on the first launch after an install', () => {
    // Arrange
    runAs({ argv: ['monfil.exe', '--squirrel-firstrun'] });

    // Act
    startAutoUpdates();
    vi.advanceTimersByTime(MINUTE);

    // Assert
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();

    // Act
    vi.advanceTimersByTime(4 * 60 * MINUTE);

    // Assert
    expect(mockAutoUpdater.checkForUpdates).toHaveBeenCalledOnce();
  });

  test('leaves a Store build to the Store', () => {
    // Arrange
    runAs({ windowsStore: true });

    // Act
    startAutoUpdates();
    vi.advanceTimersByTime(MINUTE);

    // Assert
    expect(mockAutoUpdater.setFeedURL).not.toHaveBeenCalled();
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  test('does not check on Linux', () => {
    // Arrange
    runAs({ platform: 'linux' });

    // Act
    startAutoUpdates();
    vi.advanceTimersByTime(MINUTE);

    // Assert
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  test('tells the renderer when an update is ready and stops checking', () => {
    // Arrange
    runAs({});
    startAutoUpdates();

    // Act
    mockAutoUpdater.emit('update-downloaded');
    vi.advanceTimersByTime(8 * 60 * MINUTE);

    // Assert
    expect(getUpdateState()).toEqual({ name: 'READY_TO_INSTALL' });
    expect(mockedBroadcast).toHaveBeenCalledWith('app:update-state-changed', { name: 'READY_TO_INSTALL' });
    expect(mockAutoUpdater.checkForUpdates).not.toHaveBeenCalled();
  });

  test('keeps running after a failed check', () => {
    // Arrange
    runAs({});
    startAutoUpdates();

    // Act
    mockAutoUpdater.emit('error', new Error('offline'));

    // Assert
    expect(getUpdateState()).toEqual({ name: 'NONE' });
  });
});

describe('installUpdate', () => {
  test('does nothing before an update is ready', () => {
    // Arrange
    runAs({});
    startAutoUpdates();

    // Act
    installUpdate();

    // Assert
    expect(mockAutoUpdater.quitAndInstall).not.toHaveBeenCalled();
  });

  test('restarts into a downloaded update', () => {
    // Arrange
    runAs({});
    startAutoUpdates();
    mockAutoUpdater.emit('update-downloaded');

    // Act
    installUpdate();

    // Assert
    expect(mockAutoUpdater.quitAndInstall).toHaveBeenCalledOnce();
  });
});
