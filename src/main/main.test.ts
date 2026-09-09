import { beforeEach, describe, expect, test, vi } from 'vitest';

const mockQuit = vi.fn();
const mockOn = vi.fn();
const mockGetPath = vi.fn(() => 'mock-user-data');

vi.mock(import('electron'), () => ({
  app: { quit: mockQuit, on: mockOn, getPath: mockGetPath } as unknown as Electron.App,
  BrowserWindow: vi.fn(() => ({
    maximize: vi.fn(),
    loadURL: vi.fn(),
    loadFile: vi.fn(),
  })) as unknown as typeof Electron.BrowserWindow,
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
});
