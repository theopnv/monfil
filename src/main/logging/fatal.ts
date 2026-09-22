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

interface FatalDependencies {
  app: FatalApp;
  dialog: FatalDialog;
  shell: FatalShell;
}

const electronDependencies: FatalDependencies = { app, dialog, shell };

export function createFatalHandler(log: Logger, logFilePath: string, dependencies: FatalDependencies = electronDependencies): (source: string, error: unknown) => Promise<void> {
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
      const result = await dependencies.dialog.showMessageBox({
        type: 'error',
        title: 'Monfil could not continue',
        message: `Monfil encountered a system error. Incident ${shortIncidentId(incidentId)}.`,
        buttons: ['Restart', 'Show log file', 'Quit'],
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

export function installFatalHandlers(log: Logger, logFilePath: string): void {
  const handle = createFatalHandler(log, logFilePath);

  process.on('uncaughtException', (error) => void handle('uncaughtException', error));
  process.on('unhandledRejection', (error) => void handle('unhandledRejection', error));
  app.on('render-process-gone', (_event, _webContents, details) => void handle('render-process-gone', details));
  app.on('child-process-gone', (_event, details) => void handle('child-process-gone', details));
}
