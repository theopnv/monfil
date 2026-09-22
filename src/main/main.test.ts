import { beforeEach, describe, expect, test, vi } from 'vitest';
import path from 'node:path';

const mockQuit = vi.fn();
const mockOn = vi.fn();
const mockGetPath = vi.fn(() => 'mock-user-data');
const mockGetAppPath = vi.fn(() => 'mock-app-path');
const mockGetName = vi.fn(() => 'monfil');
const mockSetPath = vi.fn();
const mockHasSwitch = vi.fn(() => true);
const mockDockSetIcon = vi.fn();
const mockMkdirSync = vi.fn();
let mockIsPackaged = false;

vi.mock(import('electron'), () => ({
  app: {
    quit: mockQuit,
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
  BrowserWindow: vi.fn(function () {
    return { maximize: vi.fn(), loadURL: vi.fn(), loadFile: vi.fn() };
  }) as unknown as typeof Electron.BrowserWindow,
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
    mockQuit.mockClear();
    mockOn.mockClear();
    mockDockSetIcon.mockClear();
    mockSetPath.mockClear();
    mockMkdirSync.mockClear();
    mockHasSwitch.mockClear();
    mockHasSwitch.mockReturnValue(true);
    mockIsPackaged = false;
  });

  test('quits without bootstrapping on a Squirrel install/uninstall event', async () => {
    // Arrange
    vi.doMock('electron-squirrel-startup', () => ({ default: true }));

    // Act
    await import('./main');

    // Assert
    expect(mockQuit).toHaveBeenCalledTimes(1);
    expect(mockOn).not.toHaveBeenCalled();
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
