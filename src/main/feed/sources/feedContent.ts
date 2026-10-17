// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { parseFeed } from 'feedsmith';
import { extractAtomImageUrl, extractImageUrl, extractJsonImageUrl, extractRdfImageUrl } from '../extractImage';
import { decodeOptional, decodeText, resolveGuid } from './text';
import type { ParsedFeedContent } from './types';

/** Parses RSS, Atom, RDF or JSON Feed content. Throws on content that is none of them. */
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
