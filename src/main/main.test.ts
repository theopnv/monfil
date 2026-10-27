// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import path from 'node:path';
import { initializeDatabase } from './db/database';
import { configureLogging, logger } from './logging/logger';
import { installFatalHandlers } from './logging/fatal';
import { setLogFilePath } from './app/main-state';
import { getDetailedLogging } from './app/settings';
import { allowPrivateHosts } from './lib/fetch';
import { configureYouTubeEmbedReferrer, denyWebPermissions, hardenWebContents } from './app/window-security';
import { startRefreshScheduler } from './feed/scheduler';

const mockQuit = vi.fn();
const mockRequestSingleInstanceLock = vi.fn(() => true);
const mockOn = vi.fn();
const mockGetPath = vi.fn((_name: string) => 'mock-user-data');
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
      webContents: {},
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

vi.mock(import('./app/window-security'), () => ({
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

vi.mock(import('./lib/fetch'), () => ({
  allowPrivateHosts: vi.fn(),
} as unknown as typeof import('./lib/fetch')));

vi.mock(import('./db/database'), () => ({
  initializeDatabase: vi.fn().mockResolvedValue(undefined),
  closeDatabase: vi.fn().mockResolvedValue(undefined),
  dbStatus: { name: 'OK' } as const,
}));

vi.mock(import('./app/settings'), () => ({
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

vi.mock(import('./app/main-state'), () => ({
  setLogFilePath: vi.fn(),
}));

vi.mock(import('./feed/scheduler'), () => ({
  startRefreshScheduler: vi.fn().mockResolvedValue(undefined),
  stopRefreshScheduler: vi.fn(),
}));

vi.mock(import('./updates/auto-updater'), () => ({
  getUpdateState: vi.fn(() => ({ name: 'NONE' as const })),
  installUpdate: vi.fn(),
  startAutoUpdates: vi.fn(),
  stopAutoUpdates: vi.fn(),
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
    mockGetPath.mockImplementation(() => 'mock-user-data');
    mockIsPackaged = false;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  async function launchAndGetWindow() {
    const { BrowserWindow } = await import('electron');
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    await import('./main');
    const ready = mockOn.mock.calls.find(([event]) => event === 'ready')?.[1] as () => void;
    ready();
    return vi.mocked(BrowserWindow).mock.results[0]?.value as Electron.BrowserWindow;
  }

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

  test('opens the database file that earlier versions wrote in userData', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));

    // Act
    await import('./main');

    // Assert
    expect(initializeDatabase).toHaveBeenCalledWith(path.join('mock-user-data', 'monfil.db'));
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
    expect(mockHasSwitch).toHaveBeenCalledWith('user-data-dir');
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

  test('writes the log file in userData and shares its path with diagnostics and the fatal handlers', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    mockGetPath.mockImplementation((name: string) => (name === 'userData' ? 'mock-user-data' : 'other-dir'));
    const logFilePath = path.join('mock-user-data', 'monfil.log');

    // Act
    await import('./main');

    // Assert
    expect(configureLogging).toHaveBeenNthCalledWith(1, logFilePath, false);
    expect(setLogFilePath).toHaveBeenCalledWith(logFilePath);
    expect(installFatalHandlers).toHaveBeenCalledWith(logger, logFilePath);
  });

  test('turns on detailed logging once the database is open when the user enabled it', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: false }));
    vi.mocked(getDetailedLogging).mockResolvedValueOnce(true);

    // Act
    await import('./main');

    // Assert
    await vi.waitFor(() => {
      expect(configureLogging).toHaveBeenNthCalledWith(2, path.join('mock-user-data', 'monfil.log'), true);
    });
  });

  test.each([
    { e2e: '1', allowsPrivateHosts: true, showsWindow: false },
    { e2e: '0', allowsPrivateHosts: false, showsWindow: true },
  ])('with E2E_TEST=$e2e, private hosts allowed: $allowsPrivateHosts, window shown: $showsWindow', async ({ e2e, allowsPrivateHosts, showsWindow }) => {
    // Arrange
    vi.stubEnv('E2E_TEST', e2e);
    const { BrowserWindow } = await import('electron');

    // Act
    await launchAndGetWindow();

    // Assert
    expect(vi.mocked(allowPrivateHosts).mock.calls).toHaveLength(allowsPrivateHosts ? 1 : 0);
    expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({ show: showsWindow }));
  });

  test('keeps the renderer isolated from Node and hardens its web contents', async () => {
    // Arrange
    const { BrowserWindow } = await import('electron');

    // Act
    const window = await launchAndGetWindow();

    // Assert
    expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      webPreferences: expect.objectContaining({ contextIsolation: true, nodeIntegration: false, sandbox: true }),
    }));
    expect(hardenWebContents).toHaveBeenCalledWith(window.webContents);
    expect(window.maximize).toHaveBeenCalledTimes(1);
  });

  test('denies web permissions and sets the YouTube embed referrer on the default session at ready', async () => {
    // Arrange
    const { session } = await import('electron');

    // Act
    await launchAndGetWindow();

    // Assert
    expect(denyWebPermissions).toHaveBeenCalledWith(session.defaultSession);
    expect(configureYouTubeEmbedReferrer).toHaveBeenCalledWith(session.defaultSession);
  });

  test.each([
    { platform: 'darwin', dark: false, overlay: false },
    { platform: 'win32', dark: false, overlay: { color: '#ebddc5', symbolColor: '#201e1d', height: 32 } },
    { platform: 'linux', dark: true, overlay: { color: '#272019', symbolColor: '#f2e7d6', height: 32 } },
  ])('uses title bar overlay $overlay on $platform (dark colors: $dark)', async ({ platform, dark, overlay }) => {
    // Arrange
    const { BrowserWindow, nativeTheme } = await import('electron');
    const originalPlatform = process.platform;
    Object.defineProperty(process, 'platform', { value: platform, configurable: true });
    Object.defineProperty(nativeTheme, 'shouldUseDarkColors', { value: dark, configurable: true });

    try {
      // Act
      await launchAndGetWindow();

      // Assert
      expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({ titleBarStyle: 'hidden', titleBarOverlay: overlay }));
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform, configurable: true });
      Object.defineProperty(nativeTheme, 'shouldUseDarkColors', { value: false, configurable: true });
    }
  });

  test('takes the window icon from the app source tree when unpackaged', async () => {
    // Arrange
    const { BrowserWindow } = await import('electron');

    // Act
    await launchAndGetWindow();

    // Assert
    expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      icon: path.join('mock-app-path', 'assets/icons/icon.png'),
    }));
  });

  test('takes the window icon from the packaged resources directory', async () => {
    // Arrange
    const { BrowserWindow } = await import('electron');
    mockIsPackaged = true;
    Object.defineProperty(process, 'resourcesPath', { value: 'mock-resources-path', configurable: true });

    // Act
    await launchAndGetWindow();

    // Assert
    expect(BrowserWindow).toHaveBeenCalledWith(expect.objectContaining({
      icon: path.join('mock-resources-path', 'icon.png'),
    }));
  });

  test('loads the built renderer page when no dev server URL is set', async () => {
    // Arrange, Act
    const window = await launchAndGetWindow();

    // Assert
    expect(window.loadFile).toHaveBeenCalledWith(path.join(__dirname, '../renderer/main_window/index.html'));
    expect(window.loadURL).not.toHaveBeenCalled();
  });

  test('loads the dev server when its URL is set', async () => {
    // Arrange
    vi.stubGlobal('MAIN_WINDOW_VITE_DEV_SERVER_URL', 'http://localhost:5173');

    // Act
    const window = await launchAndGetWindow();

    // Assert
    expect(window.loadURL).toHaveBeenCalledWith('http://localhost:5173');
    expect(window.loadFile).not.toHaveBeenCalled();
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
