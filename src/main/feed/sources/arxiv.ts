// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createFeedSource, toUrl } from './feedSource';
import type { FeedCandidate, ParsedFeedContent } from './types';

const LISTING_HOSTS = new Set(['arxiv.org', 'www.arxiv.org', 'export.arxiv.org']);
const FEED_HOST = 'rss.arxiv.org';
const LISTING_REGEX = /^\/list\/([\w.+-]+)\/[\w-]+\/?$/;
const FEED_REGEX = /^\/(?:rss|atom)\/[\w.+-]+\/?$/;
// The feedsmith parse drops `arxiv:announce_type`, but arXiv repeats it at the head of every description.
const REPLACEMENT_REGEX = /Announce Type:\s*replace/i;

/** The arXiv category feed a listing link leads to. */
export function arxivCandidates(raw: string): FeedCandidate[] | null {
  const url = toUrl(raw);
  const host = url?.hostname.toLowerCase();
  if (!url || !host) {
    return null;
  }
  if (host === FEED_HOST && FEED_REGEX.test(url.pathname)) {
    return [{ link: `https://${FEED_HOST}${url.pathname}` }];
  }
  const category = LISTING_HOSTS.has(host) ? LISTING_REGEX.exec(url.pathname)?.[1] : undefined;
  return category ? [{ link: `https://${FEED_HOST}/rss/${category}`, label: category }] : null;
}

export function isArxivLink(raw: string): boolean {
  return arxivCandidates(raw) !== null;
}

/** Replacements are new versions of papers already announced, so they would show each paper twice. */
function dropReplacements(content: ParsedFeedContent): ParsedFeedContent {
  return { ...content, items: content.items.filter((item) => !REPLACEMENT_REGEX.test(item.description.slice(0, 80))) };
}

export const arxivSource = createFeedSource({
  type: 'arxiv',
  fetchesFullArticle: false,
  toCandidates: arxivCandidates,
  mismatchMessage: 'This is not an arXiv listing link, such as arxiv.org/list/cs.AI/recent.',
  transform: dropReplacements,
});
