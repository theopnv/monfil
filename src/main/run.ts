import { listOfFeeds, type FeedItem } from './types';
import { fetchUrl } from './fetch';
import { sendToRenderer } from './ipcSend';
import { parseFeed } from 'feedsmith';

export function getFeed(content: string, maxItems: number = 10): FeedItem[] {
  const { format, feed } = parseFeed(content, { maxItems });

  if (format === 'rss') {
    if (feed.items) {
      return feed.items.map(item => ({
        title: item.title ?? 'No title',
        link: item.link,
        pubDate: item.pubDate ?? 'No publication date'
      }));
    }
  }
  return [];
}

export function run(mainWindow: Electron.BrowserWindow) {
  listOfFeeds.forEach(async (feed) => {
    try {
      const result = await fetchUrl(feed.link);
      if (!result.success) {
        switch (result.error.name) {
          case 'GENERIC_FETCH_ERROR':
          case 'NETWORK_ERROR':
          case 'NOT_ALLOWED_OR_ABORTED_ERROR':
            sendToRenderer(mainWindow, 'feeds:result', { success: false, error: result.error });
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
      sendToRenderer(mainWindow, 'feeds:result', { success: true, value: { ...feed, items } });
    } catch (error) {
      if (error instanceof Error) {
        sendToRenderer(mainWindow, 'feeds:result', { success: false, error: { name: 'PARSE_ERROR', message: error.message } });
      }
    }
  });
}
