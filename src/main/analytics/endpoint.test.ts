// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { resolveAnalyticsEndpoint, type AnalyticsConfig } from './endpoint';

const packaged: AnalyticsConfig = { key: 'A-EU-1234567890', host: undefined, isPackaged: true, isE2E: false, override: undefined };

describe('resolveAnalyticsEndpoint', () => {
  test.each([
    ['A-EU-1234567890', 'https://eu.aptabase.com/api/v0/events'],
    ['A-US-1234567890', 'https://us.aptabase.com/api/v0/events'],
  ])('maps %s to its region', (key, url) => {
    // Act
    const endpoint = resolveAnalyticsEndpoint({ ...packaged, key });

    // Assert
    expect(endpoint).toEqual({ name: 'ENABLED', url, key });
  });

  test('ignores a host for a hosted region', () => {
    // Act
    const endpoint = resolveAnalyticsEndpoint({ ...packaged, host: 'https://analytics.example.com' });

    // Assert
    expect(endpoint).toMatchObject({ url: 'https://eu.aptabase.com/api/v0/events' });
  });

  test('uses the host of a self-hosted key and drops any path', () => {
    // Act
    const endpoint = resolveAnalyticsEndpoint({ ...packaged, key: 'A-SH-1234567890', host: 'https://analytics.example.com:8080/base/' });

    // Assert
    expect(endpoint).toEqual({ name: 'ENABLED', url: 'https://analytics.example.com:8080/api/v0/events', key: 'A-SH-1234567890' });
  });

  test.each([
    ['no host', undefined, 'MISSING_HOST'],
    ['an empty host', '', 'MISSING_HOST'],
    ['a host that is not a URL', 'analytics', 'INVALID_HOST'],
    ['a host with another protocol', 'ftp://analytics.example.com', 'INVALID_HOST'],
  ])('disables a self-hosted key with %s', (_label, host, reason) => {
    // Act
    const endpoint = resolveAnalyticsEndpoint({ ...packaged, key: 'A-SH-1234567890', host });

    // Assert
    expect(endpoint).toEqual({ name: 'DISABLED', reason });
  });

  test.each([undefined, ''])('is disabled without a key (%s)', (key) => {
    // Act, Assert
    expect(resolveAnalyticsEndpoint({ ...packaged, key })).toEqual({ name: 'DISABLED', reason: 'NO_KEY' });
  });

  test.each(['A-XX-123', 'B-EU-123', 'A-EU-', 'A-EU-12x', 'garbage'])('is disabled for the key %s', (key) => {
    // Act, Assert
    expect(resolveAnalyticsEndpoint({ ...packaged, key })).toEqual({ name: 'DISABLED', reason: 'INVALID_KEY' });
  });

  test('is disabled in a development build', () => {
    // Act, Assert
    expect(resolveAnalyticsEndpoint({ ...packaged, isPackaged: false })).toEqual({ name: 'DISABLED', reason: 'DEVELOPMENT' });
  });

  test('is disabled in an end-to-end run', () => {
    // Act, Assert
    expect(resolveAnalyticsEndpoint({ ...packaged, isE2E: true })).toEqual({ name: 'DISABLED', reason: 'E2E' });
  });

  test('sends to the override in an end-to-end run, even in a development build', () => {
    // Act
    const endpoint = resolveAnalyticsEndpoint({ key: undefined, host: undefined, isPackaged: false, isE2E: true, override: 'http://127.0.0.1:9/api/v0/events' });

    // Assert
    expect(endpoint).toEqual({ name: 'ENABLED', url: 'http://127.0.0.1:9/api/v0/events', key: 'A-SH-E2E' });
  });

  test('ignores the override outside an end-to-end run', () => {
    // Act
    const endpoint = resolveAnalyticsEndpoint({ ...packaged, override: 'http://127.0.0.1:9/api/v0/events' });

    // Assert
    expect(endpoint).toMatchObject({ url: 'https://eu.aptabase.com/api/v0/events' });
  });
});
