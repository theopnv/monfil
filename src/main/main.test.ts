// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import path from 'node:path';
import { initializeDatabase } from './db/database';
import { configureLogging } from './logging/logger';
import { startRefreshScheduler } from './feed/scheduler';

const mockQuit = vi.fn();
const mockRequestSingleInstanceLock = vi.fn(() => true);
const mockOn = vi.fn();
const mockGetPath = vi.fn(() => 'mock-user-data');
const mockGetAppPath = vi.fn(() => 'mock-app-path');
const mockGetName = vi.fn(() => 'monfil');
const mockSetPath = vi.fn();
const mockHasSwitch = vi.fn(() => true);
const mockDockSetIcon = vi.fn();
const mockMkdirSync = vi.fn();
const mockGetAllWindows = vi.fn(() => [] as Electron.BrowserWindow[]);
let mockIsPackaged = false;

vi.mock(import('electron'), () => ({
  app: {
    quit: mockQuit,
    requestSingleInstanceLock: mockRequestSingleInstanceLock,
    on: mockOn,
    getPath: mockGetPath,
    getAppPath: mockGetAppPath,
    getName: mockGetName,
    setPath: mockSetPath,
    commandLine: { hasSwitch: mockHasSwitch },
    get isPackaged() {
      return mockIsPackaged;
    },
    dock: { setIcon: mockDockSetIcon },
  } as unknown as Electron.App,
  BrowserWindow: Object.assign(vi.fn(function () {
    return {
      maximize: vi.fn(),
      loadURL: vi.fn(),
      loadFile: vi.fn(),
      isMinimized: vi.fn(() => false),
      restore: vi.fn(),
      show: vi.fn(),
      focus: vi.fn(),
    };
  }), { getAllWindows: mockGetAllWindows }) as unknown as typeof Electron.BrowserWindow,
  nativeTheme: { shouldUseDarkColors: false } as Electron.NativeTheme,
  session: { defaultSession: {} } as typeof Electron.session,
}));

vi.mock(import('./window-security'), () => ({
  configureYouTubeEmbedReferrer: vi.fn(),
  denyWebPermissions: vi.fn(),
  hardenWebContents: vi.fn(),
}));

vi.mock(import('node:fs'), () => ({
  mkdirSync: mockMkdirSync,
}));

vi.mock(import('./ipc/registerIpcHandlers'), () => ({
  registerIpcHandlers: vi.fn(),
}));

vi.mock(import('./ipc/registerIpcListeners'), () => ({
  registerIpcListeners: vi.fn(),
}));

vi.mock(import('./db/database'), () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
  dbStatus: { name: 'OK' } as const,
}));

vi.mock(import('./settings'), () => ({
  getDetailedLogging: vi.fn().mockResolvedValue(false),
}));

vi.mock(import('./logging/logger'), () => ({
  configureLogging: vi.fn(),
  logger: {
    child: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock(import('./logging/fatal'), () => ({
  installFatalHandlers: vi.fn(),
}));

vi.mock(import('./main-state'), () => ({
  setLogFilePath: vi.fn(),
}));

vi.mock(import('./feed/scheduler'), () => ({
  startRefreshScheduler: vi.fn().mockResolvedValue(undefined),
  stopRefreshScheduler: vi.fn(),
}));

describe('main', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', undefined);
    vi.stubGlobal('MAIN_WINDOW_VITE_NAME', 'main_window');
    mockRequestSingleInstanceLock.mockReturnValue(true);
    mockGetAllWindows.mockReturnValue([]);
    mockHasSwitch.mockReturnValue(true);
    mockIsPackaged = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('quits without bootstrapping on a Squirrel install/uninstall event', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: true }));

    // Act
    await import('./main');

    // Assert
    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(mockOn).not.toHaveBeenCalled();
    expect(mockRequestSingleInstanceLock).not.toHaveBeenCalled();
  });

  test('bootstraps normally when not launched as a Squirrel event', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));

    // Act
    await import('./main');

    // Assert
    expect(mockQuit).not.toHaveBeenCalled();
    expect(mockOn).toHaveBeenCalledWith('ready', expect.any(Function));
  });

  test('loads the preload bundle with the extension emitted by Forge 8', async () => {
    // Arrange
    const { BrowserWindow } = await import('electron');
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    await import('./main');
    const ready = mockOn.mock.calls.find(([event]) => event === 'ready')?.[1] as () => void;

    // Act
    ready();

    // Assert
    expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      webPreferences: expect.objectContaining({ preload: expect.stringMatching(/preload\.cjs$/) }),
    }));
  });

  test('quits before opening the database or logging when another instance holds the lock', async () => {
    // Arrange
    const { BrowserWindow } = await import('electron');
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    mockRequestSingleInstanceLock.mockReturnValue(false);

    // Act
    await import('./main');

    // Assert
    expect(mockRequestSingleInstanceLock).toHaveBeenCalledTimes(1);
    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(initializeDatabase).not.toHaveBeenCalled();
    expect(configureLogging).not.toHaveBeenCalled();
    expect(mockOn).not.toHaveBeenCalled();
    expect(BrowserWindow).not.toHaveBeenCalled();
    expect(startRefreshScheduler).not.toHaveBeenCalled();
  });

  test.each([false, true])('focuses the existing window on a second launch (minimized: %s)', async (minimized) => {
    // Arrange
    const { BrowserWindow } = await import('electron');
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    await import('./main');
    const ready = mockOn.mock.calls.find(([event]) => event === 'ready')?.[1] as () => void;
    ready();
    const window = vi.mocked(BrowserWindow).mock.results[0]?.value as Electron.BrowserWindow;
    vi.mocked(window.isMinimized).mockReturnValue(minimized);
    mockGetAllWindows.mockReturnValue([window]);
    const handler = mockOn.mock.calls.find(([event]) => event === 'second-instance')?.[1] as () => void;

    // Act
    handler();

    // Assert
    expect(window.restore).toHaveBeenCalledTimes(minimized ? 1 : 0);
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
    expect(BrowserWindow).toHaveBeenCalledTimes(1);
    expect(initializeDatabase).toHaveBeenCalledTimes(1);
    expect(startRefreshScheduler).toHaveBeenCalledTimes(1);
    if (minimized) {
      expect(vi.mocked(window.restore).mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(window.focus).mock.invocationCallOrder[0] ?? 0);
    }
  });

  test('creates a window on a second launch when all windows were closed', async () => {
    // Arrange
    const { BrowserWindow } = await import('electron');
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    await import('./main');
    const ready = mockOn.mock.calls.find(([event]) => event === 'ready')?.[1] as () => void;
    ready();
    const handler = mockOn.mock.calls.find(([event]) => event === 'second-instance')?.[1] as () => void;

    // Act
    handler();

    // Assert
    expect(BrowserWindow).toHaveBeenCalledTimes(2);
    const window = vi.mocked(BrowserWindow).mock.results[1]?.value as Electron.BrowserWindow;
    expect(window.show).toHaveBeenCalledTimes(1);
    expect(window.focus).toHaveBeenCalledTimes(1);
    expect(initializeDatabase).toHaveBeenCalledTimes(1);
    expect(startRefreshScheduler).toHaveBeenCalledTimes(1);
  });

  test('quits on window-all-closed everywhere except macOS', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    await import('./main');
    const call = mockOn.mock.calls.find(([event]) => event === 'window-all-closed');
    if (!call) {
      throw new Error('window-all-closed handler was not registered');
    }
    const handler = call[1] as () => void;
    const originalPlatform = process.platform;

    try {
      // Act, Assert
      Object.defineProperty(process, 'platform', { value: 'darwin', configurable: true });
      handler();
      expect(mockQuit).not.toHaveBeenCalled();

      Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
      handler();
      expect(mockQuit).toHaveBeenCalledTimes(1);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
    }
  });

  test('redirects userData to a dev directory when unpackaged and no --user-data-dir was passed', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    mockHasSwitch.mockReturnValue(false);

    // Act
    await import('./main');

    // Assert
    expect(mockMkdirSync).toHaveBeenCalledWith(path.join('mock-user-data', 'monfil-dev'), { recursive: true });
    expect(mockSetPath).toHaveBeenCalledWith('userData', path.join('mock-user-data', 'monfil-dev'));
    expect(mockSetPath.mock.invocationCallOrder[0]).toBeLessThan(mockRequestSingleInstanceLock.mock.invocationCallOrder[0] ?? 0);
    expect(mockRequestSingleInstanceLock.mock.invocationCallOrder[0]).toBeLessThan(vi.mocked(initializeDatabase).mock.invocationCallOrder[0] ?? 0);
  });

  test('leaves userData alone when an explicit --user-data-dir was passed', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    mockHasSwitch.mockReturnValue(true);

    // Act
    await import('./main');

    // Assert
    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(mockSetPath).not.toHaveBeenCalled();
  });

  test('leaves userData alone when packaged', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    mockHasSwitch.mockReturnValue(false);
    mockIsPackaged = true;
    Object.defineProperty(process, 'resourcesPath', { value: 'mock-resources-path', configurable: true });

    // Act
    await import('./main');

    // Assert
    expect(mockMkdirSync).not.toHaveBeenCalled();
    expect(mockSetPath).not.toHaveBeenCalled();
  });
});
