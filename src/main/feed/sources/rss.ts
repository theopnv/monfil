// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchText } from '../../lib/fetch';
import type { FeedFetchError, ParsedSource } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';
import { findAlternateLinks, probeLinks } from './discovery';
import { parseFeedContent } from './feedContent';
import { fetchAndParse, fetchCandidates, mapFetchError, unsupported, withScheme } from './feedSource';
import { mastodonCandidates, mastodonSource } from './mastodon';
import type { SourceAdapter, SourceFetchInput, SourceFetchResult } from './types';

export { parseFeedContent } from './feedContent';

function safeParse(body: string): ReturnType<typeof parseFeedContent> {
  try {
    return parseFeedContent(body);
  } catch {
    return null;
  }
}

async function fetchFeed(input: SourceFetchInput): Promise<Result<SourceFetchResult, FeedFetchError>> {
  const link = withScheme(input.link);
  const fetched = await fetchAndParse(link, input.validators, parseFeedContent);
  if (!fetched.success) {
    return fetched;
  }
  if ('notModified' in fetched.data) {
    return { success: true, data: fetched.data };
  }
  const { parsed, validators } = fetched.data;
  return { success: true, data: { validators, parsed: { type: 'rss', link, title: parsed.title, description: parsed.description, items: parsed.items, icon: undefined } } };
}

async function probe(pageUrl: string): Promise<ParsedSource | undefined> {
  for (const link of probeLinks(pageUrl)) {
    const found = await fetchCandidates('rss', [{ link }], parseFeedContent);
    if (found.success && found.data[0]) {
      return found.data[0];
    }
  }
  return undefined;
}

/**
 * Finds the feeds behind any link: the link itself when it is a feed, else the feeds the page
 * advertises, else the common feed paths on its origin. Mastodon profile and tag links on any host
 * are tried as Mastodon first, because the host alone cannot tell.
 */
async function discover(query: string): Promise<Result<ParsedSource[], FeedFetchError>> {
  const link = withScheme(query.trim());
  let pageUrl: URL;
  try {
    pageUrl = new URL(link);
  } catch {
    return unsupported("This doesn't look like a link.");
  }

  if (mastodonCandidates(link, true)) {
    const mastodon = await mastodonSource.discover(link);
    if (mastodon.success) {
      return mastodon;
    }
  }

  const page = await fetchText(link);
  if (!page.success) {
    return { success: false, error: mapFetchError(page.error) };
  }
  const direct = safeParse(page.data.body);
  if (direct) {
    return { success: true, data: [{ type: 'rss', link, title: direct.title, description: direct.description, items: direct.items, icon: undefined }] };
  }

  const advertised = findAlternateLinks(page.data.body, pageUrl.href);
  if (advertised.length > 0) {
    const found = await fetchCandidates('rss', advertised.map((alternate) => ({ link: alternate })), parseFeedContent);
    if (found.success) {
      return found;
    }
  }

  const probed = await probe(pageUrl.href);
  return probed ? { success: true, data: [probed] } : unsupported("Couldn't find a feed at that address.");
}

export const rssSource: SourceAdapter = {
  type: 'rss',
  fetchesFullArticle: true,
  matches: () => true,
  discover,
  fetch: fetchFeed,
  parse: parseFeedContent,
};
