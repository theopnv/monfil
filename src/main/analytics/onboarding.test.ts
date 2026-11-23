// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import type { FeedFetchError, ParsedSource } from '../../shared/contracts';
import { incrementCounter } from './counters';
import { recordFeedAdded, recordFeedDiscovery } from './onboarding';

vi.mock(import('./counters'), () => ({ incrementCounter: vi.fn() }));

const counted = () => vi.mocked(incrementCounter).mock.calls.map(([name]) => name);
const failure = (name: FeedFetchError['name'], params?: Record<string, string>) => ({ success: false as const, error: { name, message: 'x', ...(params ? { params } : {}) } });

describe('recordFeedDiscovery', () => {
  test('counts an attempt that found a feed and nothing else', () => {
    // Act
    recordFeedDiscovery({ success: true, data: [{ link: 'https://x.test/feed' } as ParsedSource] });

    // Assert
    expect(counted()).toEqual(['feed_add_attempted']);
  });

  test('counts an address that holds no feed', () => {
    // Act
    recordFeedDiscovery({ success: true, data: [] });

    // Assert
    expect(counted()).toEqual(['feed_add_attempted', 'feed_add_failed_discovery_none']);
  });

  test.each([
    ['a web page without a feed', failure('PARSE_ERROR', { reason: 'htmlPage' }), 'feed_add_failed_discovery_none'],
    ['a feed that does not parse', failure('PARSE_ERROR'), 'feed_add_failed_parse'],
    ['an address of a kind that is not supported', failure('UNSUPPORTED_FORMAT'), 'feed_add_failed_unsupported'],
    ['a dropped connection', failure('NETWORK_ERROR'), 'feed_add_failed_network'],
    ['an HTTP error', failure('GENERIC_FETCH_ERROR'), 'feed_add_failed_network'],
    ['a request that was aborted', failure('NOT_ALLOWED_OR_ABORTED_ERROR'), 'feed_add_failed_network'],
    ['a response that is too large', failure('RESPONSE_TOO_LARGE_ERROR'), 'feed_add_failed_network'],
    ['a blocked address', failure('BLOCKED_URL_ERROR'), 'feed_add_failed_network'],
  ])('counts %s', (_label, result, counter) => {
    // Act
    recordFeedDiscovery(result);

    // Assert
    expect(counted()).toEqual(['feed_add_attempted', counter]);
  });

  test('counts only the attempt for an error without a bucket', () => {
    // Act
    recordFeedDiscovery(failure('UNKNOWN_ERROR'));

    // Assert
    expect(counted()).toEqual(['feed_add_attempted']);
  });
});

describe('recordFeedAdded', () => {
  test('counts a feed that was stored', () => {
    // Act
    recordFeedAdded({ success: true, data: {} });

    // Assert
    expect(counted()).toEqual(['feed_add_succeeded']);
  });

  test('counts nothing for a failed save', () => {
    // Act
    recordFeedAdded({ success: false, error: { name: 'DB_ERROR' } });

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });
});
