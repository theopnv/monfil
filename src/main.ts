import { listOfFeeds } from './database'
import { fetchUrl } from './fetch'
import type { UserInterface } from './ui/UserInterface'
import { consoleUI } from './ui/console/console'
import { getFeed } from './parse'

async function run(ui: UserInterface) {
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
                    default: {
                      const exhaustiveCheck: never = result.error;
                      ui.displayError(new Error(`Unhandled error type: ${exhaustiveCheck}`));
                      break;
                    }
                }
                return;
            }
            ui.displayMessage(getFeed(result.value));
        } catch (error) {
          if (error instanceof Error) {
            ui.displayError(error);
          }
        }
    });
}

run(consoleUI);
