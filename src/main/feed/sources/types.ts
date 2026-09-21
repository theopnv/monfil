import type { FeedItem } from '../../db/types';
import type { FeedFetchError, ParsedSource, SourceType } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';

export type NewSourceItem = Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>;

/**
 * One source type the app can subscribe to. `registry.ts` holds one adapter per `SourceType`.
 * See doc/sources.md for how to add a second one.
 */
export interface SourceAdapter {
  readonly type: SourceType;
  /** Whether a subscribed item's own link should be fetched and run through Readability. */
  readonly fetchesFullArticle: boolean;
  /** Retrieves and parses a subscription at `link`. */
  fetch(link: string, maxItems?: number): Promise<Result<ParsedSource, FeedFetchError>>;
  /** Parses already-retrieved content, so callers can test the parse without the network. */
  parse(content: string, maxItems?: number): { title: string; description: string; items: NewSourceItem[] } | null;
}
