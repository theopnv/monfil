// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchText } from '../../lib/fetch';
import { createFeedSource, toUrl } from './feedSource';
import { titlePosts } from './social';
import type { FeedCandidate } from './types';

const HOSTS = new Set(['bsky.app', 'www.bsky.app']);
const HANDLE_REGEX = /^@?([a-z0-9-]+(?:\.[a-z0-9-]+)+)$/i;
const PROFILE_REGEX = /^\/profile\/([^/]+)/;

function profileCandidate(actor: string): FeedCandidate {
  return { link: `https://bsky.app/profile/${actor}/rss` };
}

/**
 * The Bluesky profile feed a link or handle leads to.
 * @param lenient accept a bare custom-domain handle, for when the Bluesky chip is picked
 */
export function blueskyCandidates(raw: string, lenient: boolean): FeedCandidate[] | null {
  const trimmed = raw.trim();
  const handle = HANDLE_REGEX.exec(trimmed)?.[1];
  if (handle && (lenient || trimmed.startsWith('@') || handle.toLowerCase().endsWith('.bsky.social'))) {
    return [profileCandidate(handle.toLowerCase())];
  }
  const url = toUrl(trimmed);
  if (!url || !HOSTS.has(url.hostname.toLowerCase())) {
    return null;
  }
  const actor = PROFILE_REGEX.exec(url.pathname)?.[1];
  return actor ? [profileCandidate(decodeURIComponent(actor))] : null;
}

export function isBlueskyLink(raw: string): boolean {
  return blueskyCandidates(raw, false) !== null;
}

async function profileAvatar(candidate: FeedCandidate): Promise<string | undefined> {
  const actor = PROFILE_REGEX.exec(new URL(candidate.link).pathname)?.[1];
  if (!actor) {
    return undefined;
  }
  const result = await fetchText(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(decodeURIComponent(actor))}`);
  if (!result.success) {
    return undefined;
  }
  return (JSON.parse(result.data.body) as { avatar?: string }).avatar;
}

export const blueskySource = createFeedSource({
  type: 'bluesky',
  fetchesFullArticle: false,
  toCandidates: blueskyCandidates,
  mismatchMessage: 'This is not a Bluesky profile link or handle.',
  transform: titlePosts,
  resolveIcon: profileAvatar,
});
