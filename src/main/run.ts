import { sendToRenderer } from './ipcSend';
import { dbReady } from './database';
import { listOfFeeds, addFeedsToDatabase } from './db/insert';
import { queryFeedMetadata, queryFeedItems, queryFeedCategory } from './db/query';
import type { Feed } from '../preload/channels';

async function queryAndSendFeeds(mainWindow: Electron.BrowserWindow) {
  const queryFeeds: Promise<Feed[]> = (async () => {
    const feedMetadataList = await queryFeedMetadata({});
    const categories = await queryFeedCategory({});
    const categoriesById = new Map(categories.map((category) => [category.id, category]));
    const feedsWithItems: Feed[] = [];

    for (const feedMetadata of feedMetadataList) {
      const category = categoriesById.get(feedMetadata.category_id);
      if (!category) {
        console.error(`No category found for feed "${feedMetadata.title}" (category_id: ${feedMetadata.category_id})`);
        continue;
      }

      const feedItems = await queryFeedItems({ feed_id: feedMetadata.id });
      feedsWithItems.push({ ...feedMetadata, items: feedItems, category });
    }

    return feedsWithItems;
  })();

  await queryFeeds.then((feeds) => {
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
