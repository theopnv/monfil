import { listOfFeeds } from './database';
import { fetchUrl } from './fetch';
import { getFeed } from './parse';

export function run(mainWindow: Electron.BrowserWindow) {
  listOfFeeds.forEach(async (url) => {
    try {
      const result = await fetchUrl(url);
      if (!result.success) {
        switch (result.error.name) {
          case 'GENERIC_FETCH_ERROR':
          case 'NETWORK_ERROR':
          case 'NOT_ALLOWED_OR_ABORTED_ERROR':
              mainWindow.webContents.send('feeds:result', { url, result })
              break;
          default: {
            const exhaustiveCheck: never = result.error;
            void exhaustiveCheck;
            break;
          }
        }
        return;
      }
      const items = getFeed(result.value);
      mainWindow.webContents.send('feeds:result', { url, result: { success: true, value: items } })
      } catch (error) {
        if (error instanceof Error) {
          mainWindow.webContents.send('feeds:result', {
            url,
            result: { success: false, error: { name: 'PARSE_ERROR', message: error.message } },
          })
        }
      }
});
}
