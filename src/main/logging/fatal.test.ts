// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { Logger } from './logger';
import { createFatalHandler } from './fatal';

function dependencies(response: number) {
  return {
    app: {
      isReady: vi.fn(() => true),
      relaunch: vi.fn(),
      exit: vi.fn(),
      quit: vi.fn(),
    },
    dialog: {
      showMessageBox: vi.fn(async () => ({ response })),
    },
    shell: {
      showItemInFolder: vi.fn(),
    },
  };
}

function logger(): Logger {
  return {
    child: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('fatal recovery handler', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('logs an incident and restarts the app', async () => {
    // Arrange
    const deps = dependencies(0);
    const log = logger();
    const handle = createFatalHandler(log, 'mock-user-data/monfil.log', deps);

    // Act
    await handle('uncaughtException', new Error('broken'));

    // Assert
    expect(log.error).toHaveBeenCalledWith('system.failure', expect.objectContaining({ source: 'uncaughtException', incidentId: expect.any(String) }), expect.any(Error));
    expect(deps.app.relaunch).toHaveBeenCalledOnce();
    expect(deps.app.exit).toHaveBeenCalledWith(0);
  });

  test('reveals the log file and permits a later dialog', async () => {
    // Arrange
    const deps = dependencies(1);
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    await handle('unhandledRejection', new Error('first'));
    await handle('unhandledRejection', new Error('second'));

    // Assert
    expect(deps.shell.showItemInFolder).toHaveBeenCalledTimes(2);
    expect(deps.shell.showItemInFolder).toHaveBeenCalledWith('mock-user-data/monfil.log');
  });

  test('quits after the user selects Quit', async () => {
    // Arrange
    const deps = dependencies(2);
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    await handle('child-process-gone', { reason: 'crashed' });

    // Assert
    expect(deps.app.quit).toHaveBeenCalledOnce();
  });

  test('does not show a dialog before Electron is ready', async () => {
    // Arrange
    const deps = dependencies(0);
    deps.app.isReady.mockReturnValue(false);
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    await handle('render-process-gone', new Error('early'));

    // Assert
    expect(deps.dialog.showMessageBox).not.toHaveBeenCalled();
    expect(deps.app.relaunch).not.toHaveBeenCalled();
  });

  test('deduplicates concurrent fatal dialogs', async () => {
    // Arrange
    const deps = dependencies(1);
    let resolveDialog: ((value: { response: number }) => void) | undefined;
    deps.dialog.showMessageBox.mockImplementation(() => new Promise((resolve) => {
      resolveDialog = resolve;
    }));
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    const first = handle('uncaughtException', new Error('first'));
    const second = handle('unhandledRejection', new Error('second'));
    resolveDialog?.({ response: 1 });
    await Promise.all([first, second]);

    // Assert
    expect(deps.dialog.showMessageBox).toHaveBeenCalledOnce();
  });

  test('offers Restart, Show log file and Quit, with Restart as default and Quit as the escape', async () => {
    // Arrange
    const deps = dependencies(2);
    const log = logger();
    const handle = createFatalHandler(log, 'mock-user-data/monfil.log', deps);

    // Act
    await handle('uncaughtException', new Error('broken'));

    // Assert
    const incidentId = vi.mocked(log.error).mock.lastCall?.[1] as unknown as { incidentId: string };
    expect(deps.dialog.showMessageBox).toHaveBeenCalledExactlyOnceWith({
      type: 'error',
      title: 'Monfil could not continue',
      message: `Monfil encountered a system error. Incident ${incidentId.incidentId.slice(0, 8)}.`,
      buttons: ['Restart', 'Show log file', 'Quit'],
      defaultId: 0,
      cancelId: 2,
    });
  });

  test('restarting does not quit or reveal the log file', async () => {
    // Arrange
    const deps = dependencies(0);
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    await handle('uncaughtException', new Error('broken'));

    // Assert
    expect(deps.app.quit).not.toHaveBeenCalled();
    expect(deps.shell.showItemInFolder).not.toHaveBeenCalled();
  });

  test('revealing the log file does not restart or quit', async () => {
    // Arrange
    const deps = dependencies(1);
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    await handle('uncaughtException', new Error('broken'));

    // Assert
    expect(deps.app.relaunch).not.toHaveBeenCalled();
    expect(deps.app.exit).not.toHaveBeenCalled();
    expect(deps.app.quit).not.toHaveBeenCalled();
  });

  test('quitting does not restart or reveal the log file', async () => {
    // Arrange
    const deps = dependencies(2);
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    await handle('uncaughtException', new Error('broken'));

    // Assert
    expect(deps.app.relaunch).not.toHaveBeenCalled();
    expect(deps.app.exit).not.toHaveBeenCalled();
    expect(deps.shell.showItemInFolder).not.toHaveBeenCalled();
  });

  test('logs the failure before Electron is ready', async () => {
    // Arrange
    const deps = dependencies(0);
    deps.app.isReady.mockReturnValue(false);
    const log = logger();
    const handle = createFatalHandler(log, 'mock-user-data/monfil.log', deps);

    // Act
    await handle('uncaughtException', new Error('early'));

    // Assert
    expect(log.error).toHaveBeenCalledOnce();
  });

  test('shows a dialog for a later error after one that came before Electron was ready', async () => {
    // Arrange
    const deps = dependencies(1);
    deps.app.isReady.mockReturnValueOnce(false);
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    await handle('uncaughtException', new Error('early'));
    await handle('uncaughtException', new Error('late'));

    // Assert
    expect(deps.dialog.showMessageBox).toHaveBeenCalledOnce();
  });

  test('ignores a second error while the first dialog is open, and logs only the first', async () => {
    // Arrange
    const deps = dependencies(1);
    let resolveDialog: ((value: { response: number }) => void) | undefined;
    deps.dialog.showMessageBox.mockImplementation(() => new Promise((resolve) => {
      resolveDialog = resolve;
    }));
    const log = logger();
    const handle = createFatalHandler(log, 'mock-user-data/monfil.log', deps);

    // Act
    const first = handle('uncaughtException', new Error('first'));
    await handle('unhandledRejection', new Error('second'));
    resolveDialog?.({ response: 2 });
    await first;

    // Assert
    expect(log.error).toHaveBeenCalledOnce();
    expect(deps.app.quit).toHaveBeenCalledOnce();
  });

  test('does not reject when recovery actions fail', async () => {
    // Arrange
    const deps = dependencies(1);
    deps.shell.showItemInFolder.mockRejectedValue(new Error('shell unavailable'));
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    const result = handle('uncaughtException', new Error('broken'));

    // Assert
    await expect(result).resolves.toBeUndefined();
  });
});
