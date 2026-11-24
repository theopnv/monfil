// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { refreshErrorBucket, refreshErrorCounter } from './error-buckets';

describe('refreshErrorBucket', () => {
  test.each([
    [{ name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' }, 'too_large'],
    [{ name: 'PARSE_ERROR', message: 'bad xml' }, 'parse'],
    [{ name: 'UNSUPPORTED_FORMAT', message: 'not a feed' }, 'parse'],
    [{ name: 'GENERIC_FETCH_ERROR', message: 'HTTP 404', params: { reason: 'notFound', status: 404 } }, 'http_4xx'],
    [{ name: 'GENERIC_FETCH_ERROR', message: 'HTTP 429', params: { reason: 'rateLimited', status: 429 } }, 'http_4xx'],
    [{ name: 'GENERIC_FETCH_ERROR', message: 'HTTP 503', params: { reason: 'serverError', status: 503 } }, 'http_5xx'],
    [{ name: 'NETWORK_ERROR', message: 'Could not resolve example.com.' }, 'dns'],
    [{ name: 'NETWORK_ERROR', message: 'net::ERR_NAME_NOT_RESOLVED' }, 'dns'],
    [{ name: 'NETWORK_ERROR', message: 'net::ERR_CERT_DATE_INVALID' }, 'tls'],
    [{ name: 'NETWORK_ERROR', message: 'net::ERR_SSL_PROTOCOL_ERROR' }, 'tls'],
    [{ name: 'NETWORK_ERROR', message: 'The operation was aborted due to timeout' }, 'timeout'],
    [{ name: 'NETWORK_ERROR', message: 'net::ERR_CONNECTION_TIMED_OUT' }, 'timeout'],
  ])('puts %j in the %s bucket', (error, bucket) => {
    // Act, Assert
    expect(refreshErrorBucket(error)).toBe(bucket);
  });

  test.each([
    [{ name: 'GENERIC_FETCH_ERROR', message: 'Too many redirects.', params: { reason: 'redirects' } }],
    [{ name: 'GENERIC_FETCH_ERROR', message: 'HTTP 302', params: { status: 302 } }],
    [{ name: 'NETWORK_ERROR', message: 'The connection dropped while reading the response.' }],
    [{ name: 'BLOCKED_URL_ERROR', message: 'This address is not on the public internet.' }],
    [{ name: 'UNKNOWN_ERROR', message: 'oops' }],
    ['text'],
    [undefined],
  ])('has no bucket for %j', (error) => {
    // Act, Assert
    expect(refreshErrorBucket(error)).toBeUndefined();
  });

  test('names the counter of a bucket', () => {
    // Act, Assert
    expect(refreshErrorCounter({ name: 'PARSE_ERROR', message: 'bad' })).toBe('refresh_error_parse');
    expect(refreshErrorCounter({ name: 'UNKNOWN_ERROR', message: 'bad' })).toBeUndefined();
  });
});
