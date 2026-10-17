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
const DID_REGEX = /^did:[a-z]+:[\w.:-]+$/i;

/** The profile's handle or DID, or undefined when the path segment is neither, e.g. a malformed percent-encoding. */
function decodeActor(actor: string): string | undefined {
  let decoded: string;
  try {
    decoded = decodeURIComponent(actor);
  } catch {
    return undefined;
  }
  return (HANDLE_REGEX.test(decoded) && !decoded.startsWith('@')) || DID_REGEX.test(decoded) ? decoded : undefined;
}

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
  const rawActor = PROFILE_REGEX.exec(url.pathname)?.[1];
  const actor = rawActor === undefined ? undefined : decodeActor(rawActor);
  return actor ? [profileCandidate(actor)] : null;
}

export function isBlueskyLink(raw: string): boolean {
  return blueskyCandidates(raw, false) !== null;
}

async function profileAvatar(candidate: FeedCandidate): Promise<string | undefined> {
  const rawActor = PROFILE_REGEX.exec(new URL(candidate.link).pathname)?.[1];
  const actor = rawActor === undefined ? undefined : decodeActor(rawActor);
  if (!actor) {
    return undefined;
  }
  const result = await fetchText(`https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(actor)}`);
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
