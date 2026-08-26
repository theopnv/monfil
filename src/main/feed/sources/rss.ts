import { createHash } from 'node:crypto';
import { parseFeed } from 'feedsmith';
import { decode, EntityLevel } from 'entities';
import { fetchUrl } from '../../lib/fetch';
import type { Result } from '../../lib/utils';
import { extractAtomImageUrl, extractImageUrl } from '../extractImage';
import { DEFAULT_MAX_FEED_ITEMS } from '../../settings';
import type { FeedFetchError, NewSourceItem, ParsedSource, SourceAdapter } from './types';

interface ParsedFeedContent {
  title: string;
  description: string;
  items: NewSourceItem[];
}

// Some feeds put literal entities like "&#8217;" inside a CDATA section, where XML parsers
// leave them untouched by spec. Decode them here so titles and descriptions render as text.
function decodeText(text: string): string {
  return decode(text, EntityLevel.HTML);
}

function decodeOptional(text: string | undefined): string | undefined {
  return text === undefined ? undefined : decodeText(text);
}

// Every item needs an identity, and a feed may supply neither a guid nor a link, so fall back to a
// digest of the fields that are always there. The prefix keeps it clear of real guids.
function resolveGuid(guid: string | undefined, link: string | undefined, title: string, pubDate: string): string {
  if (guid) {
    return guid;
  }
  if (link) {
    return link;
  }
  return `monfil:hash:${createHash('sha1').update(`${title} ${pubDate}`).digest('hex')}`;
}

export function parseFeedContent(content: string, maxItems: number = 0): ParsedFeedContent | null {
  const { format, feed } = parseFeed(content, { maxItems });
  switch (format) {
    case 'rss':
      return {
        title: decodeText(feed.title ?? ''),
        description: decodeText(feed.description ?? ''),
        items: feed.items
          ? feed.items.map(item => {
            const title = decodeText(item.title ?? 'No title');
            const pubDate = item.pubDate ?? 'No publication date';
            return {
              title,
              guid: resolveGuid(item.guid?.value, item.link, title, pubDate),
              link: item.link,
              pubDate,
              description: decodeText(item.description ?? ''),
              image: extractImageUrl(item),
              author: decodeOptional(item.authors?.[0]?.name ?? item.dc?.creators?.[0]),
              extra: undefined,
              read_at: undefined,
            };
          })
          : [],
      };
    case 'atom':
      return {
        title: decodeText(feed.title?.value ?? ''),
        description: decodeText(feed.subtitle?.value ?? ''),
        items: feed.entries
          ? feed.entries.map(entry => {
            const title = decodeText(entry.title?.value ?? 'No title');
            const pubDate = entry.published ?? entry.updated ?? 'No publication date';
            const link = entry.links?.find(link => link.rel === 'alternate' || !link.rel)?.href ?? entry.links?.[0]?.href;
            return {
              title,
              guid: resolveGuid(entry.id, link, title, pubDate),
              link,
              pubDate,
              description: decodeText(entry.summary?.value ?? entry.content?.value ?? ''),
              image: extractAtomImageUrl(entry),
              author: decodeOptional(entry.authors?.[0]?.name),
              extra: undefined,
              read_at: undefined,
            };
          })
          : [],
      };
    case 'rdf':
    case 'json':
      return null;
    default: {
      const exhaustiveCheck: never = format;
      return exhaustiveCheck;
    }
  }
}

async function fetchFeed(link: string, maxItems: number = DEFAULT_MAX_FEED_ITEMS): Promise<Result<ParsedSource, FeedFetchError>> {
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
      return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a supported RSS or Atom feed." } };
    }
    return { success: true, data: { type: 'rss', link: normalizedLink, title: parsed.title, description: parsed.description, items: parsed.items } };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: { name: 'PARSE_ERROR', message: error.message } };
    }
    return { success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } };
  }
}

export const rssSource: SourceAdapter = {
  type: 'rss',
  fetch: fetchFeed,
  parse: parseFeedContent,
};
