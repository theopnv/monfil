import { listOfFeeds } from './database'
import { fetchUrl } from './fetch'
import type { IUserInterface } from './ui/IUserInterface'
import { consoleUI } from './ui/console/console'
import { getFeed } from './parse'

async function run(ui: IUserInterface) {

  listOfFeeds.forEach(async (url) => {
    try {
      const result = await fetchUrl(url);
      if (!result.success) {
        switch (result.error.name) {
          case 'GENERIC_FETCH_ERROR':
          case 'NETWORK_ERROR':
          case 'NOT_ALLOWED_OR_ABORTED_ERROR':
            ui.displayError(result.error);
            break;
          default:
            const exhaustiveCheck: never = result.error;
            ui.displayError(new Error(`Unhandled error type: ${exhaustiveCheck}`));
            break;
        }
        return;
      }
      getFeed(result.value);
    } catch (error) {
      console.error(`Error fetching or parsing feed from ${url}:`, error);
    }
  });
}

run(consoleUI);
