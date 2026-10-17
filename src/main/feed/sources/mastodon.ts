// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { parseFeed } from 'feedsmith';
import { createFeedSource, toUrl } from './feedSource';
import { titlePosts } from './social';
import type { FeedCandidate } from './types';

const FULL_HANDLE_REGEX = /^@([\w.-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
const BARE_HANDLE_REGEX = /^@?([\w.-]+)@([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
const PATH_REGEX = /^\/(@\w+|tags\/[\w-]+)(\.rss)?\/?$/;

/** Whether `raw` is a full `@user@host` handle, the one Mastodon shape safe to detect without a request. */
export function isMastodonHandle(raw: string): boolean {
  return FULL_HANDLE_REGEX.test(raw.trim());
}

/**
 * The Mastodon feed a handle, profile link or tag link leads to.
 * @param lenient accept profile and tag links on any host and handles without the leading `@`;
 *   Mastodon runs on any host, so without this only a full `@user@host` handle is recognised
 */
export function mastodonCandidates(raw: string, lenient: boolean): FeedCandidate[] | null {
  const trimmed = raw.trim();
  const handle = (lenient ? BARE_HANDLE_REGEX : FULL_HANDLE_REGEX).exec(trimmed);
  if (handle?.[1] && handle[2]) {
    return [{ link: `https://${handle[2].toLowerCase()}/@${handle[1]}.rss` }];
  }
  if (!lenient) {
    return null;
  }
  const url = toUrl(trimmed);
  const path = url ? PATH_REGEX.exec(url.pathname)?.[1] : undefined;
  return url && path ? [{ link: `${url.origin}/${path}.rss` }] : null;
}

async function feedImage(_candidate: FeedCandidate, body: string): Promise<string | undefined> {
  const { format, feed } = parseFeed(body, { maxItems: 0 });
  return Promise.resolve(format === 'rss' ? feed.image?.url : undefined);
}

export const mastodonSource = createFeedSource({
  type: 'mastodon',
  fetchesFullArticle: false,
  toCandidates: mastodonCandidates,
  mismatchMessage: 'This is not a Mastodon profile, tag or @user@host handle.',
  transform: titlePosts,
  resolveIcon: feedImage,
});
