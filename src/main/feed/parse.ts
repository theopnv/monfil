import { type FeedItem } from '../types';
import { fetchUrl } from '../fetch';
import { parseFeed } from 'feedsmith';
import type { Result } from '../../utils';

export function parseFeedItems(content: string, maxItems: number = 10) {
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

type FeedItemsOrError = Result<Omit<FeedItem, "id" | "feed_id">[], { name: string; message: string }>;

export async function getFeedItems(link: string): Promise<FeedItemsOrError> {
  try {
    const result = await fetchUrl(link);
    if (!result.success) {
      switch (result.error.name) {
        case 'GENERIC_FETCH_ERROR':
        case 'NETWORK_ERROR':
        case 'NOT_ALLOWED_OR_ABORTED_ERROR':
          return { success: false, error: result.error };
        default: {
          const exhaustiveCheck: never = result.error;
          return { success: false, error: exhaustiveCheck };
        }
      }
    }
    const items = parseFeedItems(result.data);
    return { success: true, data: items };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: { name: 'PARSE_ERROR', message: error.message } };
    }
  }
  return { success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } };
}
