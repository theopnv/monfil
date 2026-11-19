// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { app, dialog, shell } from 'electron';
import type { Logger } from './logger';
import { createIncidentId, shortIncidentId } from './incident';

interface FatalApp {
  isReady(): boolean;
  relaunch(): void;
  exit(code?: number): void;
  quit(): void;
}

interface FatalDialog {
  showMessageBox(options: Electron.MessageBoxOptions): Promise<{ response: number }>;
}

interface FatalShell {
  showItemInFolder(path: string): void | Promise<void>;
}

export interface FatalDialogText {
  title: string;
  message: string;
  buttons: [restart: string, showLog: string, quit: string];
}

interface FatalDependencies {
  app: FatalApp;
  dialog: FatalDialog;
  shell: FatalShell;
  text: (incident: string) => FatalDialogText;
}

const electronDependencies = { app, dialog, shell };

export function createFatalHandler(log: Logger, logFilePath: string, dependencies: FatalDependencies): (source: string, error: unknown) => Promise<void> {
  let showingDialog = false;

  return async (source: string, error: unknown) => {
    if (showingDialog) {
      return;
    }
    showingDialog = true;
    try {
      const incidentId = createIncidentId();
      log.error('system.failure', { source, incidentId }, error);
      if (!dependencies.app.isReady()) {
        showingDialog = false;
        return;
      }
      const text = dependencies.text(shortIncidentId(incidentId));
      const result = await dependencies.dialog.showMessageBox({
        type: 'error',
        title: text.title,
        message: text.message,
        buttons: text.buttons,
        defaultId: 0,
        cancelId: 2,
      });
      if (result.response === 0) {
        dependencies.app.relaunch();
        dependencies.app.exit(0);
      } else if (result.response === 1) {
        await dependencies.shell.showItemInFolder(logFilePath);
        showingDialog = false;
      } else {
        dependencies.app.quit();
      }
    } catch {
      // A failure inside the fatal path must not trigger another unhandled rejection.
    }
  };
}

export function installFatalHandlers(log: Logger, logFilePath: string, text: FatalDependencies['text']): void {
  const handle = createFatalHandler(log, logFilePath, { ...electronDependencies, text });

  process.on('uncaughtException', (error) => void handle('uncaughtException', error));
  process.on('unhandledRejection', (error) => void handle('unhandledRejection', error));
  app.on('render-process-gone', (_event, _webContents, details) => void handle('render-process-gone', details));
  app.on('child-process-gone', (_event, details) => void handle('child-process-gone', details));
}
