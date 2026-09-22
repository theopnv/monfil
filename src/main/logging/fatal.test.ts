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
