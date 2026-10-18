// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { SourceType } from '../../../shared/contracts';
import { arxivSource, isArxivLink } from './arxiv';
import { blueskySource, isBlueskyLink } from './bluesky';
import { conferenceSource, isConferenceLink } from './conference';
import { githubSource, isGithubLink } from './github';
import { gitlabSource, isGitlabLink } from './gitlab';
import { hackernewsSource, isHackernewsLink } from './hackernews';
import { mastodonSource } from './mastodon';
import { rssSource } from './rss';
import type { SourceAdapter } from './types';
import { isYoutubeLink, youtubeSource } from './youtube';

// `satisfies` is the exhaustiveness guard: adding a member to SourceType breaks the build here until an adapter for it exists
const sources = {
  rss: rssSource,
  youtube: youtubeSource,
  github: githubSource,
  gitlab: gitlabSource,
  hackernews: hackernewsSource,
  arxiv: arxivSource,
  bluesky: blueskySource,
  mastodon: mastodonSource,
  conference: conferenceSource,
} satisfies Record<SourceType, SourceAdapter>;

// Checked in order, so a more specific source must come before a broader one. RSS takes the rest.
const DETECTION_ORDER: SourceAdapter[] = [youtubeSource, githubSource, gitlabSource, hackernewsSource, arxivSource, blueskySource, mastodonSource, conferenceSource];

/**
 * The adapter that owns a stored feed.
 * @param type the `type` column of the feed's row
 */
export function sourceFor(type: SourceType): SourceAdapter {
  return sources[type];
}

/**
 * The adapter to use for a link the user has just typed, before anything about it is stored.
 * @param link the raw text from the Add Feed wizard
 * @param hint the Step 1 chip, when the user has picked a type explicitly rather than leaving it to host sniffing
 */
export function resolveSource(link: string, hint?: SourceType): SourceAdapter {
  if (hint) {
    return sources[hint];
  }
  return DETECTION_ORDER.find((source) => source.matches(link)) ?? rssSource;
}

/**
 * The type to store for a feed URL that is already known, such as an OPML `xmlUrl`.
 * Mastodon feeds stay `rss` here: any host can run Mastodon, and this must not touch the network.
 */
export function detectType(feedUrl: string): SourceType {
  if (isYoutubeLink(feedUrl)) {
    return 'youtube';
  }
  if (isGithubLink(feedUrl)) {
    return 'github';
  }
  if (isGitlabLink(feedUrl)) {
    return 'gitlab';
  }
  if (isHackernewsLink(feedUrl)) {
    return 'hackernews';
  }
  if (isArxivLink(feedUrl)) {
    return 'arxiv';
  }
  if (isConferenceLink(feedUrl)) {
    return 'conference';
  }
  return /^https?:\/\//i.test(feedUrl) && isBlueskyLink(feedUrl) ? 'bluesky' : 'rss';
}
