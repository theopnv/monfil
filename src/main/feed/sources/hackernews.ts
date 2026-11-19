// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createFeedSource, toUrl } from './feedSource';
import type { FeedCandidate } from './types';
import { mainI18n } from '../../lib/i18n';

const SITE_HOST = 'news.ycombinator.com';
const HNRSS_HOST = 'hnrss.org';

// "Show HN" and "Ask HN" are the names of the site's own sections, so they stay as they are.
const presets = (): FeedCandidate[] => [
  { link: `https://${SITE_HOST}/rss`, label: mainI18n.t('main:source.hackernews.frontPage') },
  { link: `https://${HNRSS_HOST}/newest?points=100`, label: mainI18n.t('main:source.hackernews.points100') },
  { link: `https://${HNRSS_HOST}/newest?points=300`, label: mainI18n.t('main:source.hackernews.points300') },
  { link: `https://${HNRSS_HOST}/show`, label: 'Show HN' },
  { link: `https://${HNRSS_HOST}/ask`, label: 'Ask HN' },
];

const sections = (): Record<string, FeedCandidate> => ({
  '/newest': { link: `https://${HNRSS_HOST}/newest`, label: mainI18n.t('main:source.hackernews.newest') },
  '/best': { link: `https://${HNRSS_HOST}/best`, label: mainI18n.t('main:source.hackernews.best') },
  '/show': { link: `https://${HNRSS_HOST}/show`, label: 'Show HN' },
  '/ask': { link: `https://${HNRSS_HOST}/ask`, label: 'Ask HN' },
});

/** The Hacker News feeds a link leads to: the presets for the site itself, one feed for a section or a feed URL. */
export function hackernewsCandidates(raw: string): FeedCandidate[] | null {
  const url = toUrl(raw);
  const host = url?.hostname.toLowerCase();
  if (!url || (host !== SITE_HOST && host !== HNRSS_HOST)) {
    return null;
  }
  if (host === HNRSS_HOST || url.pathname === '/rss') {
    return [{ link: `https://${host}${url.pathname}${url.search}` }];
  }
  const section = sections()[url.pathname];
  return section ? [section] : presets();
}

export function isHackernewsLink(raw: string): boolean {
  return hackernewsCandidates(raw) !== null;
}

export const hackernewsSource = createFeedSource({
  type: 'hackernews',
  fetchesFullArticle: true,
  toCandidates: hackernewsCandidates,
  mismatchMessage: 'This is not a Hacker News link.',
});
