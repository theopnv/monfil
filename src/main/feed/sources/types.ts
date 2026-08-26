import type { FeedItem, FeedMetadata, SourceType } from '../../db/types';
import type { FetchUrlError } from '../../lib/fetch';
import type { Result } from '../../lib/utils';

export type NewSourceItem = Omit<FeedItem, 'id' | 'feed_id'>;

export type ParsedSource = Omit<FeedMetadata, 'id' | 'category_id' | 'showInHome' | 'last_fetched_at' | 'last_error'> & {
  description: string;
  items: NewSourceItem[];
};

type ParseErrorCode = 'PARSE_ERROR' | 'UNKNOWN_ERROR' | 'UNSUPPORTED_FORMAT';
export type FeedFetchError =
  | FetchUrlError
  | { name: ParseErrorCode; message: string };

/**
 * One source type the app can subscribe to. `registry.ts` holds one adapter per `SourceType`.
 * See doc/sources.md for how to add a second one.
 */
export interface SourceAdapter {
  readonly type: SourceType;
  /** Retrieves and parses a subscription at `link`. */
  fetch(link: string, maxItems?: number): Promise<Result<ParsedSource, FeedFetchError>>;
  /** Parses already-retrieved content, so callers can test the parse without the network. */
  parse(content: string, maxItems?: number): { title: string; description: string; items: NewSourceItem[] } | null;
}
