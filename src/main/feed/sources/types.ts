import type { FeedItem } from '../../db/types';
import type { FeedFetchError, ParsedSource, SourceType } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';
import type { FetchValidators, NotModified } from '../../lib/fetch';

export type NewSourceItem = Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>;

export interface SourceFetchInput {
  link: string;
  /** Validators from the feed's previous fetch, replayed as conditional GET headers. */
  validators?: FetchValidators;
}

/** A parsed feed, plus the validators the fetch returned for the next conditional GET. */
export type SourceFetchResult = { parsed: ParsedSource; validators: FetchValidators } | NotModified;

/**
 * One source type the app can subscribe to. `registry.ts` holds one adapter per `SourceType`.
 * See doc/sources.md for how to add a second one.
 */
export interface SourceAdapter {
  readonly type: SourceType;
  /** Whether a subscribed item's own link should be fetched and run through Readability. */
  readonly fetchesFullArticle: boolean;
  /** Retrieves and parses a subscription at `link`. */
  fetch(input: SourceFetchInput): Promise<Result<SourceFetchResult, FeedFetchError>>;
  /** Parses already-retrieved content, so callers can test the parse without the network. */
  parse(content: string): { title: string; description: string; items: NewSourceItem[] } | null;
}
