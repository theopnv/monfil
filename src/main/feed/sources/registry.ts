import type { SourceType } from '../../db/types';
import { rssSource } from './rss';
import type { SourceAdapter } from './types';
import { isYoutubeLink, youtubeSource } from './youtube';

// `satisfies` is the exhaustiveness guard: adding a member to SourceType breaks the build here until an adapter for it exists
const sources = {
  rss: rssSource,
  youtube: youtubeSource,
} satisfies Record<SourceType, SourceAdapter>;

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
 * @param hint the Step 1 toggle, when the user has picked a type explicitly rather than leaving it to host sniffing
 */
export function resolveSource(link: string, hint?: SourceType): SourceAdapter {
  if (hint) {
    return sources[hint];
  }
  return isYoutubeLink(link) ? sources.youtube : sources.rss;
}
