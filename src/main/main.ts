import { app, BrowserWindow } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpcHandlers } from './ipc/registerIpcHandlers';
import { registerIpcListeners } from './ipc/registerIpcListeners';
import { closeDatabase, DB_FILE_NAME, initializeDatabase } from './database';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
// app.quit() only schedules an exit, so without this return the rest of the module (and its app.on(...) wiring)
// would still run during Squirrel's install/uninstall/update invocations.
if (started) {
  app.quit();
} else {
  bootstrap();
}

function bootstrap() {
  initializeDatabase(path.join(app.getPath('userData'), DB_FILE_NAME));

  const createWindow = () => {
    const mainWindow = new BrowserWindow({
      titleBarStyle: 'hidden',
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
      },
    });
    mainWindow.maximize();

    if (import.meta.env.DEV && MAIN_WINDOW_VITE_DEV_SERVER_URL) {
      mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
    } else {
      mainWindow.loadFile(
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
    registerIpcListeners();
    registerIpcHandlers();
    createWindow();
  }

  // This method will be called when Electron has finished initialization and is ready to create browser windows.
  // Some APIs can only be used after this event occurs.
  app.on('ready', main);

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
    closeDatabase().catch((error) => {
      console.error('Failed to close the database cleanly.', error);
    });
  });
}
