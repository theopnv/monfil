// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, afterEach, test, expect, vi } from 'vitest';
import { listenToLinkOpen, listenToReveal, listenToShowMenu } from './listeners';
import { BrowserWindow, Menu, shell } from 'electron';
import { setLogFilePath } from '../app/main-state';
import { refreshFeeds } from '../feed/refresh';
import { broadcastToRenderers } from '../lib/sendToRenderer';
import { useTestDatabase } from '../test/db';

const database = vi.hoisted(() => ({ status: { name: 'OK' } as { name: 'OK' } | { name: 'RESET'; quarantinePath: string; incidentId: string } }));

// A Proxy, not a spread: `db` is a live binding that a spread would copy as undefined.
vi.mock(import('../db/database'), async (importOriginal) => new Proxy(await importOriginal(), {
  get: (target, key) => (key === 'dbStatus' ? database.status : Reflect.get(target, key)),
}));
vi.mock(import('../feed/refresh'), () => ({ refreshFeeds: vi.fn() }));
vi.mock(import('../lib/sendToRenderer'), async (importOriginal) => ({ ...(await importOriginal()), broadcastToRenderers: vi.fn() }));

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

describe('app:reveal IPC listener for the database file', () => {
  useTestDatabase();

  afterEach(() => {
    mockedShowItemInFolder.mockReset();
  });

  test('reveals the database file in the OS file browser', () => {
    // Act
    listenToReveal({} as Electron.IpcMainEvent, 'database');

    // Assert
    expect(mockedShowItemInFolder).toHaveBeenCalledWith(':memory:');
  });
});

describe('app:reveal IPC listener for the log file', () => {
  afterEach(() => {
    mockedShowItemInFolder.mockReset();
  });

  test('reveals the active log file in the OS file browser', () => {
    // Arrange
    const logPath = 'mock-user-data/monfil.log';
    setLogFilePath(logPath);

    // Act
    listenToReveal({} as Electron.IpcMainEvent, 'log');

    // Assert
    expect(mockedShowItemInFolder).toHaveBeenCalledWith(logPath);
  });
});

describe('app:reveal IPC listener for the database backup', () => {
  const event = {} as Electron.IpcMainEvent;

  afterEach(() => {
    mockedShowItemInFolder.mockReset();
    database.status = { name: 'OK' };
  });

  test('reveals the quarantined database after a reset', () => {
    // Arrange
    database.status = { name: 'RESET', quarantinePath: 'mock-user-data/monfil.db.corrupt', incidentId: 'incident' };

    // Act
    listenToReveal(event, 'database-backup');

    // Assert
    expect(mockedShowItemInFolder).toHaveBeenCalledExactlyOnceWith('mock-user-data/monfil.db.corrupt');
  });

  test('reveals nothing when the database was not reset', () => {
    // Act
    listenToReveal(event, 'database-backup');

    // Assert
    expect(mockedShowItemInFolder).not.toHaveBeenCalled();
  });

  test.each(['', 'logs', undefined, null, 3])('ignores the unknown target %j', (target) => {
    // Act
    listenToReveal(event, target as never);

    // Assert
    expect(mockedShowItemInFolder).not.toHaveBeenCalled();
  });
});

describe('menu:show IPC listener with a bad target', () => {
  afterEach(() => {
    mockedBuildFromTemplate.mockReset();
  });

  test.each([{ kind: 'item', id: 1 }, { kind: 'feed', id: 0 }, { kind: 'feed', id: '1' }, { kind: 'feed' }, null, 5])('shows no menu for %j', (target) => {
    // Act
    listenToShowMenu({ sender: {} } as unknown as Electron.IpcMainEvent, target as never);

    // Assert
    expect(mockedBuildFromTemplate).not.toHaveBeenCalled();
  });
});

describe('menu:show IPC listener for a feed', () => {
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
    listenToShowMenu(event, { kind: 'feed', id: 1 });

    // Assert
    expect(mockedFromWebContents).toHaveBeenCalledWith(event.sender);
    expect(popup).toHaveBeenCalledWith({ window: fakeWindow });
  });

  test('builds a template holding Refresh, Move and Delete', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);

    // Act
    listenToShowMenu(mockEvent(), { kind: 'feed', id: 1 });

    // Assert
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    expect(template?.map((item) => item.label)).toEqual(['Refresh feed', 'Move to workspace…', 'Delete feed']);
  });

  test("the move item's click sends menu:action (feed move) with the feed id", () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'feed', id: 42 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[1]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('menu:action', { kind: 'feed', action: 'move', id: 42 });
  });

  test('the refresh item force-refreshes that feed and applies the result immediately', async () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    vi.mocked(refreshFeeds).mockResolvedValue({ perFeed: [{ feedId: 7, inserted: 2 }] });

    // Act
    listenToShowMenu(mockEvent(), { kind: 'feed', id: 7 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[0]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(refreshFeeds).toHaveBeenCalledWith([7], true);
    await vi.waitFor(() => expect(broadcastToRenderers).toHaveBeenCalledWith('feeds:refreshed', { perFeed: [{ feedId: 7, inserted: 2 }], applyImmediately: true }));
  });

  test("the template item's click sends menu:action (feed delete) with the feed id", () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'feed', id: 42 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[2]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('menu:action', { kind: 'feed', action: 'delete', id: 42 });
  });

  test('a destroyed sender sends nothing when the item is clicked', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent(true);

    // Act
    listenToShowMenu(event, { kind: 'feed', id: 42 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[2]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).not.toHaveBeenCalled();
  });

  test('does not pop the menu when no window resolves from the sender', () => {
    // Arrange
    const popup = vi.fn();
    mockedBuildFromTemplate.mockReturnValue({ popup } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(null);

    // Act
    listenToShowMenu(mockEvent(), { kind: 'feed', id: 1 });

    // Assert
    expect(popup).not.toHaveBeenCalled();
  });
});

describe('menu:show IPC listener for a category', () => {
  const fakeWindow = {} as Electron.BrowserWindow;

  function mockEvent() {
    return { sender: { isDestroyed: () => false, send: vi.fn() } } as unknown as Electron.IpcMainEvent;
  }

  afterEach(() => {
    mockedBuildFromTemplate.mockReset();
    mockedFromWebContents.mockReset();
  });

  test('builds a template holding "Rename" then "Delete"', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);

    // Act
    listenToShowMenu(mockEvent(), { kind: 'category', id: 1 });

    // Assert
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    expect(template).toHaveLength(2);
    expect(template?.[0]?.label).toBe('Rename');
    expect(template?.[1]?.label).toBe('Delete');
  });

  test('"Rename" sends menu:action (category rename) with the category id', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'category', id: 7 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[0]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('menu:action', { kind: 'category', action: 'rename', id: 7 });
  });

  test('"Delete" sends menu:action (category delete) with the category id', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'category', id: 7 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[1]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('menu:action', { kind: 'category', action: 'delete', id: 7 });
  });

  test('pops the menu at the window resolved from event.sender', () => {
    // Arrange
    const popup = vi.fn();
    mockedBuildFromTemplate.mockReturnValue({ popup } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'category', id: 1 });

    // Assert
    expect(mockedFromWebContents).toHaveBeenCalledWith(event.sender);
    expect(popup).toHaveBeenCalledWith({ window: fakeWindow });
  });
});

describe('menu:show IPC listener for a workspace', () => {
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

  test('Home gets "Edit workspace" and "Export as OPML" but no "Delete workspace"', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);

    // Act
    listenToShowMenu(mockEvent(), { kind: 'workspace', id: 1 });

    // Assert
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    expect(template).toHaveLength(2);
    expect(template?.[0]?.label).toBe('Edit workspace');
    expect(template?.[1]?.label).toBe('Export as OPML');
  });

  test('a non-Home workspace also gets "Delete workspace"', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);

    // Act
    listenToShowMenu(mockEvent(), { kind: 'workspace', id: 3 });

    // Assert
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    expect(template).toHaveLength(3);
    expect(template?.[2]?.label).toBe('Delete workspace');
  });

  test('"Delete workspace" sends menu:action (workspace delete) with the workspace id', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'workspace', id: 3 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[2]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('menu:action', { kind: 'workspace', action: 'delete', id: 3 });
  });

  test('"Edit workspace" sends menu:action (workspace edit) with the workspace id', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'workspace', id: 3 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[0]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('menu:action', { kind: 'workspace', action: 'edit', id: 3 });
  });

  test('"Export as OPML" sends menu:action (workspace export) with the workspace id', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'workspace', id: 3 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[1]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).toHaveBeenCalledWith('menu:action', { kind: 'workspace', action: 'export', id: 3 });
  });

  test('a destroyed sender sends nothing when an item is clicked', () => {
    // Arrange
    mockedBuildFromTemplate.mockReturnValue({ popup: vi.fn() } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent(true);

    // Act
    listenToShowMenu(event, { kind: 'workspace', id: 3 });
    const template = mockedBuildFromTemplate.mock.calls[0]?.[0];
    template?.[0]?.click?.(undefined as never, undefined, undefined as never);

    // Assert
    expect(event.sender.send).not.toHaveBeenCalled();
  });

  test('pops the menu at the window resolved from event.sender', () => {
    // Arrange
    const popup = vi.fn();
    mockedBuildFromTemplate.mockReturnValue({ popup } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(fakeWindow);
    const event = mockEvent();

    // Act
    listenToShowMenu(event, { kind: 'workspace', id: 1 });

    // Assert
    expect(mockedFromWebContents).toHaveBeenCalledWith(event.sender);
    expect(popup).toHaveBeenCalledWith({ window: fakeWindow });
  });

  test('does not pop the menu when no window resolves from the sender', () => {
    // Arrange
    const popup = vi.fn();
    mockedBuildFromTemplate.mockReturnValue({ popup } as unknown as Electron.Menu);
    mockedFromWebContents.mockReturnValue(null);

    // Act
    listenToShowMenu(mockEvent(), { kind: 'workspace', id: 1 });

    // Assert
    expect(popup).not.toHaveBeenCalled();
  });
});
