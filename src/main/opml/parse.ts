import { parseOpml, type Opml } from 'feedsmith';
import type { SourceType } from '../db/types';
import type { Result } from '../lib/utils';
import { isYoutubeLink } from '../feed/sources/youtube';

export interface ParsedOpmlFeed {
  title: string;
  xmlUrl: string;
  htmlUrl?: string;
  type: SourceType;
}

export interface ParsedOpmlCategory {
  name: string;
  feeds: ParsedOpmlFeed[];
}

export interface ParsedOpml {
  title: string;
  categories: ParsedOpmlCategory[];
}

export type ParseOpmlError =
  | { name: 'MALFORMED_XML'; message: string }
  | { name: 'NO_FEEDS'; message: string };

const DEFAULT_TITLE = 'Imported';

function toFeed(outline: Opml.Outline<string>): ParsedOpmlFeed | undefined {
  if (!outline.xmlUrl) {
    return undefined;
  }
  return {
    title: outline.title ?? outline.text ?? outline.xmlUrl,
    xmlUrl: outline.xmlUrl,
    ...(outline.htmlUrl ? { htmlUrl: outline.htmlUrl } : {}),
    type: isYoutubeLink(outline.xmlUrl) ? 'youtube' : 'rss',
  };
}

// A folder can itself contain sub-folders. The target model has only one level of category, so a
// nested folder's feeds fold up into the category of the outline at the top of its branch.
function collectLeafFeeds(outlines: Opml.Outline<string>[] | undefined): ParsedOpmlFeed[] {
  const feeds: ParsedOpmlFeed[] = [];
  for (const outline of outlines ?? []) {
    const feed = toFeed(outline);
    if (feed) {
      feeds.push(feed);
    } else if (outline.outlines) {
      feeds.push(...collectLeafFeeds(outline.outlines));
    }
  }
  return feeds;
}

/**
 * Parses an OPML document into the flat `{ categories }` shape the importer writes to the
 * database. A folder outline (no `xmlUrl`, holding other outlines) becomes a category; a leaf
 * outline sitting directly at the top level is grouped into one category named from the
 * document's own title.
 * @param xml the raw OPML document
 */
export function parseOpmlDocument(xml: string): Result<ParsedOpml, ParseOpmlError> {
  let document: Opml.Document<string>;
  try {
    document = parseOpml(xml);
  } catch (error) {
    return { success: false, error: { name: 'MALFORMED_XML', message: error instanceof Error ? error.message : 'Could not parse the OPML document.' } };
  }

  const categories: ParsedOpmlCategory[] = [];
  const uncategorized: ParsedOpmlFeed[] = [];

  for (const outline of document.body?.outlines ?? []) {
    const feed = toFeed(outline);
    if (feed) {
      uncategorized.push(feed);
      continue;
    }
    const feeds = collectLeafFeeds(outline.outlines);
    if (feeds.length > 0) {
      categories.push({ name: outline.text ?? DEFAULT_TITLE, feeds });
    }
  }

  if (uncategorized.length > 0) {
    categories.push({ name: document.head?.title ?? DEFAULT_TITLE, feeds: uncategorized });
  }

  const totalFeeds = categories.reduce((sum, category) => sum + category.feeds.length, 0);
  if (totalFeeds === 0) {
    return { success: false, error: { name: 'NO_FEEDS', message: 'The OPML document has no feeds.' } };
  }

  return { success: true, data: { title: document.head?.title ?? DEFAULT_TITLE, categories } };
}
