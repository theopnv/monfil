import type { SourceType } from '../../db/types';
import { rssSource } from './rss';
import type { SourceAdapter } from './types';

// `satisfies` is the exhaustiveness guard: adding a member to SourceType breaks the build here until an adapter for it exists
const sources = {
  rss: rssSource,
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
 * This is the extension point where a second type gets detected from the URL.
 * @param link the raw text from the Add Feed wizard
 */
export function resolveSource(_link: string): SourceAdapter {
  return sources.rss;
}
