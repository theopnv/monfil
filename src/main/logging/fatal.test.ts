// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { app, dialog } from 'electron';
import type { Logger } from './logger';
import { createFatalHandler, installFatalHandlers } from './fatal';

vi.mock(import('electron'), () => ({
  app: { on: vi.fn(), isReady: vi.fn(() => true), relaunch: vi.fn(), exit: vi.fn(), quit: vi.fn() } as unknown as typeof app,
  dialog: { showMessageBox: vi.fn(async () => ({ response: 2 })) } as unknown as typeof dialog,
  shell: { showItemInFolder: vi.fn() } as unknown as Electron.Shell,
}));

function dependencies(response: number, checkboxChecked = false) {
  return {
    app: {
      isReady: vi.fn(() => true),
      relaunch: vi.fn(),
      exit: vi.fn(),
      quit: vi.fn(),
    },
    dialog: {
      showMessageBox: vi.fn(async (_options: Electron.MessageBoxOptions) => ({ response, checkboxChecked })),
    },
    shell: {
      showItemInFolder: vi.fn(),
    },
    text: (incident: string) => ({
      title: 'Monfil could not continue',
      message: `Monfil encountered a system error. Incident ${incident}.`,
      buttons: ['Restart', 'Show log file', 'Quit'] as [string, string, string],
      attachLog: 'Send the log file with the error report',
    }),
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

  describe('error reports', () => {
    function reports(enabled: boolean) {
      return { enabled: vi.fn(() => enabled), flush: vi.fn(() => Promise.resolve()), attachLog: vi.fn(() => Promise.resolve()) };
    }

    test('offers to send the log when error reports are on, and sends it before the app restarts', async () => {
      // Arrange
      const deps = { ...dependencies(0, true), reports: reports(true) };
      const order: string[] = [];
      deps.reports.attachLog.mockImplementation(async () => {
        order.push('attach');
      });
      deps.app.relaunch.mockImplementation(() => order.push('relaunch'));
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(deps.dialog.showMessageBox).toHaveBeenCalledWith(expect.objectContaining({ checkboxLabel: 'Send the log file with the error report', checkboxChecked: false }));
      expect(deps.reports.attachLog).toHaveBeenCalledWith(expect.stringMatching(/^[0-9a-f]{8}$/));
      expect(order).toEqual(['attach', 'relaunch']);
    });

    test('sends the failure before the dialog opens, because a native dialog stops the network work', async () => {
      // Arrange
      const deps = { ...dependencies(0, false), reports: reports(true) };
      const order: string[] = [];
      deps.reports.flush.mockImplementation(async () => {
        order.push('flush');
      });
      deps.dialog.showMessageBox.mockImplementation(async () => {
        order.push('dialog');
        return { response: 0, checkboxChecked: false };
      });
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(order).toEqual(['flush', 'dialog']);
    });

    test('still shows the dialog when sending the failure fails', async () => {
      // Arrange
      const deps = { ...dependencies(0, false), reports: reports(true) };
      deps.reports.flush.mockRejectedValue(new Error('offline'));
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(deps.dialog.showMessageBox).toHaveBeenCalledOnce();
    });

    test('sends nothing before the dialog when error reports are off', async () => {
      // Arrange
      const deps = { ...dependencies(2, false), reports: reports(false) };
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(deps.reports.flush).not.toHaveBeenCalled();
    });

    test('sends nothing when the box stays unticked', async () => {
      // Arrange
      const deps = { ...dependencies(0, false), reports: reports(true) };
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(deps.reports.attachLog).not.toHaveBeenCalled();
    });

    test('shows no box and sends nothing when error reports are off, even if the dialog says it was ticked', async () => {
      // Arrange
      const deps = { ...dependencies(0, true), reports: reports(false) };
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(deps.dialog.showMessageBox.mock.calls[0]?.[0]).not.toHaveProperty('checkboxLabel');
      expect(deps.reports.attachLog).not.toHaveBeenCalled();
    });

    test('still restarts when sending the log fails', async () => {
      // Arrange
      const deps = { ...dependencies(0, true), reports: reports(true) };
      deps.reports.attachLog.mockRejectedValue(new Error('offline'));
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(deps.app.relaunch).toHaveBeenCalledOnce();
    });

    test('shows no box when no report path exists', async () => {
      // Arrange
      const deps = dependencies(2, true);
      const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

      // Act
      await handle('uncaughtException', new Error('broken'));

      // Assert
      expect(deps.dialog.showMessageBox.mock.calls[0]?.[0]).not.toHaveProperty('checkboxLabel');
    });
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
    let resolveDialog: ((value: { response: number; checkboxChecked: boolean }) => void) | undefined;
    deps.dialog.showMessageBox.mockImplementation(() => new Promise((resolve) => {
      resolveDialog = resolve;
    }));
    const handle = createFatalHandler(logger(), 'mock-user-data/monfil.log', deps);

    // Act
    const first = handle('uncaughtException', new Error('first'));
    const second = handle('unhandledRejection', new Error('second'));
    resolveDialog?.({ response: 1, checkboxChecked: false });
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
    let resolveDialog: ((value: { response: number; checkboxChecked: boolean }) => void) | undefined;
    deps.dialog.showMessageBox.mockImplementation(() => new Promise((resolve) => {
      resolveDialog = resolve;
    }));
    const log = logger();
    const handle = createFatalHandler(log, 'mock-user-data/monfil.log', deps);

    // Act
    const first = handle('uncaughtException', new Error('first'));
    await handle('unhandledRejection', new Error('second'));
    resolveDialog?.({ response: 2, checkboxChecked: false });
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

const STOPPABLE_SERVICE = 'article-extraction';

describe('installed process listeners', () => {
  type Listener = (...args: unknown[]) => void;

  function install() {
    const listeners = new Map<string, Listener>();
    vi.mocked(app.on).mockImplementation(((event: string, listener: Listener) => {
      listeners.set(event, listener);
      return app;
    }) as unknown as typeof app.on);
    vi.spyOn(process, 'on').mockImplementation(((event: string, listener: Listener) => {
      listeners.set(event, listener);
      return process;
    }) as unknown as typeof process.on);
    vi.mocked(app.isReady).mockReturnValue(true);
    vi.mocked(dialog.showMessageBox).mockResolvedValue({ response: 2, checkboxChecked: false });
    const log = logger();
    installFatalHandlers(log, 'mock-user-data/monfil.log', () => ({ title: 'Title', message: 'Message', buttons: ['Restart', 'Show log file', 'Quit'], attachLog: 'Attach' }), [STOPPABLE_SERVICE]);
    return Object.assign(listeners, { log });
  }

  test('shows a dialog when the renderer crashes', async () => {
    // Arrange
    const listeners = install();

    // Act
    listeners.get('render-process-gone')?.({}, {}, { reason: 'crashed' });
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());

    // Assert
    expect(app.quit).toHaveBeenCalledOnce();
    expect(listeners.log.error).toHaveBeenCalledWith('system.failure', expect.objectContaining({ source: 'render-process-gone' }), { reason: 'crashed' });
  });

  test.each(['uncaughtException', 'unhandledRejection'])('shows a dialog and logs the source for an %s', async (event) => {
    // Arrange
    const listeners = install();

    // Act
    listeners.get(event)?.(new Error('boom'));
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());

    // Assert
    expect(listeners.log.error).toHaveBeenCalledWith('system.failure', expect.objectContaining({ source: event }), expect.any(Error));
  });

  test('shows a dialog when a Chromium service crashes', async () => {
    // Arrange
    const listeners = install();

    // Act
    listeners.get('child-process-gone')?.({}, { type: 'Utility', name: 'Network Service', reason: 'crashed' });
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());

    // Assert
    expect(app.quit).toHaveBeenCalledOnce();
    expect(listeners.log.error).toHaveBeenCalledWith('system.failure', expect.objectContaining({ source: 'child-process-gone' }), expect.anything());
  });

  test.each([
    ['a process of another type that has the name of a stoppable service', { type: 'GPU', name: STOPPABLE_SERVICE, reason: 'crashed' }],
    ['a utility process with no name', { type: 'Utility', reason: 'crashed' }],
  ])('still shows a dialog for %s', async (_label, details) => {
    // Arrange
    const listeners = install();

    // Act
    listeners.get('child-process-gone')?.({}, details);
    await vi.waitFor(() => expect(dialog.showMessageBox).toHaveBeenCalledOnce());
  });

  test.each(['render-process-gone', 'child-process-gone'])('ignores a %s event while the app quits', async (event) => {
    // Arrange
    const listeners = install();
    listeners.get('before-quit')?.();

    // Act
    const details = { type: 'GPU', reason: 'killed' };
    if (event === 'render-process-gone') {
      listeners.get(event)?.({}, {}, details);
    } else {
      listeners.get(event)?.({}, details);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  test('ignores a utility process that the app stops on purpose', async () => {
    // Arrange
    const listeners = install();

    // Act
    listeners.get('child-process-gone')?.({}, { type: 'Utility', name: STOPPABLE_SERVICE, reason: 'killed' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });

  test('ignores a clean exit', async () => {
    // Arrange
    const listeners = install();

    // Act
    listeners.get('child-process-gone')?.({}, { type: 'Utility', name: 'Audio Service', reason: 'clean-exit' });
    await new Promise((resolve) => setTimeout(resolve, 0));

    // Assert
    expect(dialog.showMessageBox).not.toHaveBeenCalled();
  });
});
