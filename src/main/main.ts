import { app, BrowserWindow, session } from 'electron';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { registerIpcListeners } from './ipc/registerIpcListeners';
import { closeDatabase, dbStatus, initializeDatabase } from './db/database';
import { DB_FILE_NAME } from './constants';
import { startRefreshScheduler, stopRefreshScheduler } from './feed/scheduler';
import { stopArticleExtractionProcess } from './feed/extractArticleUtility';
import { resolveDevUserDataDir } from './dev-user-data-dir';
import { denyWebPermissions, hardenWebContents } from './window-security';
import { allowPrivateHosts } from './lib/fetch';
import { configureLogging, logger } from './logging/logger';
import { installFatalHandlers } from './logging/fatal';
import { setLogFilePath } from './main-state';
import { getDetailedLogging } from './settings';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// app.quit() only schedules an exit, so without this return the rest of the module (and its app.on(...) wiring)
// would still run during Squirrel's install/uninstall/update invocations.
if (started) {
  app.quit();
} else {
  bootstrap();
}

function bootstrap() {
  const devUserDataDir = resolveDevUserDataDir({
    isPackaged: app.isPackaged,
    hasExplicitUserDataDir: app.commandLine.hasSwitch('user-data-dir'),
    appDataDir: app.getPath('appData'),
    appName: app.getName(),
  });
  if (devUserDataDir !== null) {
    mkdirSync(devUserDataDir, { recursive: true });
    app.setPath('userData', devUserDataDir);
  }

  const logFilePath = path.join(app.getPath('userData'), 'monfil.log');
  setLogFilePath(logFilePath);
  configureLogging(logFilePath, false);
  installFatalHandlers(logger, logFilePath);

  initializeDatabase(path.join(app.getPath('userData'), DB_FILE_NAME))
    .then(async () => configureLogging(logFilePath, await getDetailedLogging()))
    .catch((error: unknown) => {
      logger.error('database.recovery', { outcome: 'failed', ...(dbStatus.name === 'FAILED' ? { incidentId: dbStatus.incidentId } : {}) }, error);
    });

  // Playwright's electron.launch() sets this so e2e runs never raise a real window and steal
  // OS focus from whatever the developer is doing, and so article fetches may reach the
  // loopback server the specs stand up.
  const isE2ETest = process.env['E2E_TEST'] === '1';
  if (isE2ETest) {
    allowPrivateHosts();
  }

  // extraResource copies this next to the packaged app; unpackaged, it's still in the source tree.
  const iconPath = app.isPackaged
    ? path.join(process.resourcesPath, 'icon.png')
    : path.join(app.getAppPath(), 'assets/icons/icon.png');

  const createWindow = () => {
    const mainWindow = new BrowserWindow({
      titleBarStyle: 'hidden',
      show: !isE2ETest,
      icon: iconPath,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        // Electron's defaults, written out so a future default change cannot widen the renderer's reach unnoticed.
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    });
    hardenWebContents(mainWindow.webContents);
    mainWindow.maximize();

    if (import.meta.env.DEV && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      void mainWindow.loadFile(
        path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
      );
    }

    if (import.meta.env.DEV) {
      // Uncomment this line to open the DevTools automatically when the app is launched in development mode.
      // mainWindow.webContents.openDevTools();
    }
    return mainWindow;
  };

  const main = () => {
    denyWebPermissions(session.defaultSession);
    registerIpcListeners();
    registerIpcHandlers();
    createWindow();
    startRefreshScheduler().catch((error: unknown) => {
      logger.error('feed.refresh', { outcome: 'failed' }, error);
    });
  }

  // This method will be called when Electron has finished initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', main);

  // On macOS, BrowserWindow's `icon` option is a no-op; the packaged app gets its icon from the
  // bundle's Info.plist, but in dev there's no bundle, so the dock icon needs setting explicitly.
  app.on('ready', () => {
    if (process.platform === 'darwin' && !app.isPackaged) {
      app.dock?.setIcon(iconPath);
    }
  });

  // Quit when all windows are closed, except on macOS. There, it's common for applications and their menu bar to stay active until the user quits explicitly with Cmd + Q.
  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
      app.quit();
    }
  });

  app.on('activate', () => {
    // On OS X it's common to re-create a window in the app when the dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });

  app.on('before-quit', () => {
    stopRefreshScheduler();
    stopArticleExtractionProcess();
    closeDatabase().catch((error) => {
      logger.error('database.recovery', { outcome: 'failed' }, error);
    });
  });
}
