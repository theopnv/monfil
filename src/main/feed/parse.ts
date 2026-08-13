import { type FeedItem, type FeedMetadata } from '../types';
import { fetchUrl } from '../fetch';
import type { FetchUrlError } from '../fetch';
import { parseFeed } from 'feedsmith';
import type { Result } from '../../utils';

interface ParsedFeedContent {
  title: string;
  description: string;
  items: Omit<FeedItem, 'id' | 'feed_id'>[];
}

export function parseFeedContent(content: string, maxItems: number = 0): ParsedFeedContent | null {
  const { format, feed } = parseFeed(content, { maxItems });
  if (format !== 'rss') return null;
  return {
    title: feed.title ?? '',
    description: feed.description ?? '',
    items: feed.items
      ? feed.items.map(item => ({
        title: item.title ?? 'No title',
        link: item.link,
        pubDate: item.pubDate ?? 'No publication date',
        description: item.description ?? '',
      }))
      : [],
  };
}

export type ParsedFeed = Omit<FeedMetadata, 'id' | 'category_id' | 'showInHome'> & {
  description: string;
  items: Omit<FeedItem, 'id' | 'feed_id'>[];
};

type ParseErrorCode = 'PARSE_ERROR' | 'UNKNOWN_ERROR' | 'UNSUPPORTED_FORMAT';
export type FeedFetchError =
  | FetchUrlError
  | { name: ParseErrorCode; message: string }

export async function fetchFeed(link: string, maxItems: number = 30): Promise<Result<ParsedFeed, FeedFetchError>> {
  const normalizedLink = /^https?:\/\//i.test(link) ? link : `https://${link}`;
  try {
    const result = await fetchUrl(normalizedLink);
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
    const parsed = parseFeedContent(result.data, maxItems);
    if (!parsed) {
      return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a supported RSS feed." } };
    }
    return { success: true, data: { link: normalizedLink, title: parsed.title, description: parsed.description, items: parsed.items } };
  } catch (error) {
    if (error instanceof Error) return { success: false, error: { name: 'PARSE_ERROR', message: error.message } };
    return { success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } };
  }
}
