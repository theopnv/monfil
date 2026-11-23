// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { FeedFetchError, ParsedSource, UsageCounter } from '../../shared/contracts';
import type { Result } from '../../shared/result';
import { incrementCounter } from './counters';

type FailedAdd = Extract<UsageCounter, `feed_add_failed_${string}`>;

function failureCounter(error: FeedFetchError): FailedAdd | undefined {
  switch (error.name) {
    case 'UNSUPPORTED_FORMAT': return 'feed_add_failed_unsupported';
    case 'PARSE_ERROR': return error.params?.['reason'] === 'htmlPage' ? 'feed_add_failed_discovery_none' : 'feed_add_failed_parse';
    case 'NETWORK_ERROR':
    case 'GENERIC_FETCH_ERROR':
    case 'NOT_ALLOWED_OR_ABORTED_ERROR':
    case 'RESPONSE_TOO_LARGE_ERROR':
    case 'BLOCKED_URL_ERROR': return 'feed_add_failed_network';
    default: return undefined;
  }
}

/** Counts a first step of adding a feed, and why it ended when it found nothing to add. */
export function recordFeedDiscovery(result: Result<ParsedSource[], FeedFetchError>): void {
  void incrementCounter('feed_add_attempted');
  const counter = result.success
    ? (result.data.length === 0 ? 'feed_add_failed_discovery_none' : undefined)
    : failureCounter(result.error);
  if (counter) {
    void incrementCounter(counter);
  }
}

export function recordFeedAdded(result: Result<unknown, unknown>): void {
  if (result.success) {
    void incrementCounter('feed_add_succeeded');
  }
}
