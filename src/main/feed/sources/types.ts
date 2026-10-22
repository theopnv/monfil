// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { FeedItem } from '../../db/types';
import type { FeedFetchError, ParsedSource, SourceType } from '../../../shared/contracts';
import type { Result } from '../../../shared/result';
import type { FetchValidators, NotModified } from '../../lib/fetch';

export type NewSourceItem = Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>;

export interface ParsedFeedContent {
  title: string;
  description: string;
  /** The website the feed belongs to, where its icon is looked up. */
  siteLink?: string | undefined;
  items: NewSourceItem[];
}

export interface SourceFetchInput {
  link: string;
  /** Validators from the feed's previous fetch, replayed as conditional GET headers. */
  validators?: FetchValidators;
}

/** A parsed feed, plus the validators the fetch returned for the next conditional GET. */
export type SourceFetchResult = { parsed: ParsedSource; validators: FetchValidators } | NotModified;

/** One feed URL that a link the user typed leads to, before it is fetched. */
export interface FeedCandidate {
  link: string;
  label?: string;
  /** An icon known without a request, e.g. a GitHub owner's avatar URL. */
  icon?: string;
  /** Set when the link came from fetched content rather than the user, so it must not reach the private network. */
  blockPrivateHosts?: boolean;
}

/**
 * One source type the app can subscribe to. `registry.ts` holds one adapter per `SourceType`.
 * See doc/src/content/docs/contributor-guide/feed-sources.md for how to add one.
 */
export interface SourceAdapter {
  readonly type: SourceType;
  /** Whether a subscribed item's own link should be fetched and run through Readability. */
  readonly fetchesFullArticle: boolean;
  /** Whether the raw wizard text belongs to this source when no chip is picked. Must not touch the network. */
  matches(query: string): boolean;
  /** Turns the raw wizard text into the feeds it leads to, fetched and parsed, default first. */
  discover(query: string): Promise<Result<ParsedSource[], FeedFetchError>>;
  /** Retrieves and parses a stored subscription at `link`. */
  fetch(input: SourceFetchInput): Promise<Result<SourceFetchResult, FeedFetchError>>;
  /** Parses already-retrieved content, so callers can test the parse without the network. */
  parse(content: string): ParsedFeedContent | null;
}
