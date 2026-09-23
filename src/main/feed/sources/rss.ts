import { parseFeed } from 'feedsmith';
import { fetchConditional, fetchText } from '../../lib/fetch';
import type { Result } from '../../../shared/result';
import { extractAtomImageUrl, extractImageUrl, extractJsonImageUrl, extractRdfImageUrl } from '../extractImage';
import { decodeOptional, decodeText, resolveGuid } from './text';
import type { FeedFetchError } from '../../../shared/contracts';
import type { NewSourceItem, SourceAdapter, SourceFetchInput, SourceFetchResult } from './types';

interface ParsedFeedContent {
  title: string;
  description: string;
  items: NewSourceItem[];
}

export function parseFeedContent(content: string): ParsedFeedContent | null {
  const { format, feed } = parseFeed(content);
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
      return {
        title: decodeText(feed.title ?? ''),
        description: decodeText(feed.description ?? ''),
        items: feed.items
          ? feed.items.map(item => {
            const title = decodeText(item.title ?? 'No title');
            const pubDate = item.dc?.dates?.[0] ?? 'No publication date';
            return {
              title,
              guid: resolveGuid(item.rdf?.about, item.link, title, pubDate),
              link: item.link,
              pubDate,
              description: decodeText(item.description ?? ''),
              image: extractRdfImageUrl(item),
              author: decodeOptional(item.dc?.creators?.[0]),
              extra: undefined,
              read_at: undefined,
            };
          })
          : [],
      };
    case 'json':
      return {
        title: decodeText(feed.title ?? ''),
        description: decodeText(feed.description ?? ''),
        items: feed.items
          ? feed.items.map(item => {
            const title = decodeText(item.title ?? 'No title');
            const pubDate = item.date_published ?? 'No publication date';
            return {
              title,
              guid: resolveGuid(item.id, item.url, title, pubDate),
              link: item.url,
              pubDate,
              description: decodeText(item.content_html ?? item.content_text ?? item.summary ?? ''),
              image: extractJsonImageUrl(item),
              author: decodeOptional(item.authors?.[0]?.name),
              extra: undefined,
              read_at: undefined,
            };
          })
          : [],
      };
    default: {
      const exhaustiveCheck: never = format;
      return exhaustiveCheck;
    }
  }
}

async function fetchFeed(input: SourceFetchInput): Promise<Result<SourceFetchResult, FeedFetchError>> {
  const normalizedLink = /^https?:\/\//i.test(input.link) ? input.link : `https://${input.link}`;
  try {
    const result = input.validators
      ? await fetchConditional(normalizedLink, { validators: input.validators })
      : await fetchText(normalizedLink);
    if (!result.success) {
      switch (result.error.name) {
        case 'GENERIC_FETCH_ERROR':
        case 'NETWORK_ERROR':
        case 'NOT_ALLOWED_OR_ABORTED_ERROR':
        case 'RESPONSE_TOO_LARGE_ERROR':
        case 'BLOCKED_URL_ERROR':
          return { success: false, error: result.error };
        default: {
          const exhaustiveCheck: never = result.error;
          return { success: false, error: exhaustiveCheck };
        }
      }
    }
    if ('notModified' in result.data) {
      return { success: true, data: result.data };
    }
    const parsed = parseFeedContent(result.data.body);
    if (!parsed) {
      return { success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a supported feed." } };
    }
    return {
      success: true,
      data: {
        validators: result.data.validators,
        parsed: { type: 'rss', link: normalizedLink, title: parsed.title, description: parsed.description, items: parsed.items, icon: undefined },
      },
    };
  } catch (error) {
    if (error instanceof Error) {
      return { success: false, error: { name: 'PARSE_ERROR', message: error.message } };
    }
    return { success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } };
  }
}

export const rssSource: SourceAdapter = {
  type: 'rss',
  fetchesFullArticle: true,
  fetch: fetchFeed,
  parse: parseFeedContent,
};
