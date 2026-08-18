import { beforeAll, describe, afterEach, test, expect, vi } from 'vitest';
import { listenToLinkOpen, listenToRevealDatabaseFile, listenToShowFeedContextMenu } from './listeners';
import { initializeDatabase } from '../database';
import { BrowserWindow, Menu, shell } from 'electron';

vi.mock(import('electron'), () => ({
  shell: {
    openExternal: vi.fn(),
    showItemInFolder: vi.fn(),
  } as unknown as Electron.Shell,
  Menu: {
    buildFromTemplate: vi.fn(),
  } as unknown as typeof Menu,
  BrowserWindow: {
    fromWebContents: vi.fn(),
  } as unknown as typeof BrowserWindow,
}));

const mockedOpenExternal = vi.mocked(shell.openExternal);
const mockedShowItemInFolder = vi.mocked(shell.showItemInFolder);
const mockedBuildFromTemplate = vi.mocked(Menu.buildFromTemplate);
const mockedFromWebContents = vi.mocked(BrowserWindow.fromWebContents);

describe('link:open IPC listener', () => {
  const mockEvent = {} as Electron.IpcMainEvent;

  afterEach(() => {
    mockedOpenExternal.mockReset();
  });

  test('should open external links for http and https protocols', () => {
    // Act
    listenToLinkOpen(mockEvent, 'https://example.com');

    // Assert
    expect(mockedOpenExternal).toHaveBeenCalledWith('https://example.com');
  });

  test('should not open external links for non-http/https protocols', () => {
    // Act
    listenToLinkOpen(mockEvent, 'ftp://example.com');

    // Assert
    expect(mockedOpenExternal).not.toHaveBeenCalled();
  });
});

describe('app:reveal-database-file IPC listener', () => {
  beforeAll(async () => {
    await initializeDatabase(':memory:');
  });

  afterEach(() => {
    mockedShowItemInFolder.mockReset();
  });

  test('reveals the database file in the OS file browser', () => {
    // Act
    listenToRevealDatabaseFile();

    // Assert
    expect(mockedShowItemInFolder).toHaveBeenCalledWith(':memory:');
  });
});

describe('feeds:show-feed-context-menu IPC listener', () => {
  const fakeWindow = {} as Electron.BrowserWindow;

  function mockEvent(isDestroyed = false) {
    return {
      sender: { isDestroyed: () => isDestroyed, send: vi.fn() },
    } as unknown as Electron.IpcMainEvent;
  }

  afterEach(() => {
    mockedBuildFromTemplate.mockReset();
    mockedFromWebContents.mockReset();
  });

  test('pops the menu at the window resolved from event.sender', () => {
    // Arrange
    const popup = vi.fn();
    mockedBuildFromTemplate.mockReturnValue({ popup } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowFeedContextMenu(event, 1);

    // Assert
    expect(mockedFromWebContents).toHaveBeenCalledWith(event.sender);
    expect(popup).toHaveBeenCalledWith({ window: fakeWindow });
  });

  test('builds a template holding one item labelled "Delete feed…"', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);

    // Act
    listenToShowFeedContextMenu(mockEvent(), 1);

    // Assert
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    expect(template).toHaveLength(1);
    expect(template?.[0]?.label).toBe('Delete feed…');
  });

  test("the template item's click sends feeds:delete-feed-requested with the feed id", () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowFeedContextMenu(event, 42);
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[0]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('feeds:delete-feed-requested', 42);
  });

  test('a destroyed sender sends nothing when the item is clicked', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent(true);

    // Act
    listenToShowFeedContextMenu(event, 42);
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[0]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).not.toHaveBeenCalled();
  });

  test('does not pop the menu when no window resolves from the sender', () => {
    // Arrange
    const popup = vi.fn();
    mockedBuildFromTemplate.mockReturnValue({ popup } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(null);

    // Act
    listenToShowFeedContextMenu(mockEvent(), 1);

    // Assert
    expect(popup).not.toHaveBeenCalled();
  });
});
