import { sendToRenderer } from './ipcSend';
import { dbReady } from './database';
import { listOfFeeds, addFeedsToDatabase } from './db/insert';
import { queryFeedMetadata, queryFeedItems } from './db/query';
import type { Feed } from '../preload/channels';

async function queryAndSendFeeds(mainWindow: Electron.BrowserWindow) {
  const queryFeeds: Promise<Feed[]> = (async () => {
    const feedMetadataList = await queryFeedMetadata({});
    const feedsWithItems: Feed[] = [];

    for (const feedMetadata of feedMetadataList) {
      const feedItems = await queryFeedItems({ feed_id: feedMetadata.id });
      feedsWithItems.push({ ...feedMetadata, items: feedItems });
    }

    return feedsWithItems;
  })();

  queryFeeds.then((feeds) => {
    feeds.forEach((feed) => {
      sendToRenderer(mainWindow, 'feeds:result', { success: true, value: feed });
    });
  }).catch((error) => {
    if (error instanceof Error) {
      sendToRenderer(mainWindow, 'feeds:result', { success: false, error: { name: 'PARSE_ERROR', message: error.message } });
    }
  });
}

export async function run(mainWindow: Electron.BrowserWindow) {
  await dbReady;
  await addFeedsToDatabase(listOfFeeds);
  await queryAndSendFeeds(mainWindow);
}
