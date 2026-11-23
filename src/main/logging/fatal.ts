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
  showMessageBox(options: Electron.MessageBoxOptions): Promise<{ response: number; checkboxChecked?: boolean }>;
}

/** Sends the log with the error report of an incident. Main passes it in, so the logging folder does not import the observability folder. */
export interface FatalReports {
  enabled(): boolean;
  attachLog(incidentId: string): Promise<void>;
}

interface FatalShell {
  showItemInFolder(path: string): void | Promise<void>;
}

export interface FatalDialogText {
  title: string;
  message: string;
  buttons: [restart: string, showLog: string, quit: string];
  attachLog: string;
}

interface FatalDependencies {
  app: FatalApp;
  dialog: FatalDialog;
  shell: FatalShell;
  text: (incident: string) => FatalDialogText;
  reports?: FatalReports;
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
      const shortId = shortIncidentId(incidentId);
      const text = dependencies.text(shortId);
      const canReport = dependencies.reports?.enabled() === true;
      const result = await dependencies.dialog.showMessageBox({
        type: 'error',
        title: text.title,
        message: text.message,
        buttons: text.buttons,
        defaultId: 0,
        cancelId: 2,
        ...(canReport ? { checkboxLabel: text.attachLog, checkboxChecked: false } : {}),
      });
      if (canReport && result.checkboxChecked) {
        await dependencies.reports?.attachLog(shortId).catch(() => undefined);
      }
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

interface ProcessGoneDetails {
  reason?: string;
  type?: string;
  name?: string;
}

function isExpectedExit(details: ProcessGoneDetails, quitting: boolean, stoppableServices: readonly string[]): boolean {
  return quitting
    || details.reason === 'clean-exit'
    // Stryker disable next-line ConditionalExpression: includes(undefined) is false as well, so the check only narrows the type
    || (details.type === 'Utility' && details.name !== undefined && stoppableServices.includes(details.name));
}

export function installFatalHandlers(log: Logger, logFilePath: string, text: FatalDependencies['text'], stoppableServices: readonly string[], reports?: FatalReports): void {
  const handle = createFatalHandler(log, logFilePath, { ...electronDependencies, text, ...(reports ? { reports } : {}) });

  process.on('uncaughtException', (error) => void handle('uncaughtException', error));
  process.on('unhandledRejection', (error) => void handle('unhandledRejection', error));
  let quitting = false;
  app.on('before-quit', () => {
    quitting = true;
  });
  app.on('render-process-gone', (_event, _webContents, details) => {
    if (!isExpectedExit(details, quitting, stoppableServices)) {
      void handle('render-process-gone', details);
    }
  });
  app.on('child-process-gone', (_event, details) => {
    if (!isExpectedExit(details, quitting, stoppableServices)) {
      void handle('child-process-gone', details);
    }
  });
}
