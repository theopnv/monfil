// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { resolveSentryEndpoint, type SentryConfig } from './endpoint';

const DSN = 'https://abc123@o42.ingest.de.sentry.io/4567';
const packaged: SentryConfig = { dsn: DSN, isPackaged: true, isE2E: false, override: undefined };

describe('resolveSentryEndpoint', () => {
  test('enables a packaged build that has a valid DSN', () => {
    // Act, Assert
    expect(resolveSentryEndpoint(packaged)).toEqual({ name: 'ENABLED', dsn: DSN });
  });

  test.each([
    ['a project path with a prefix', 'https://abc@sentry.example.com/relay/12'],
    ['a self-hosted host with a port', 'https://abc@sentry.example.com:9000/3'],
  ])('accepts %s', (_label, dsn) => {
    // Act, Assert
    expect(resolveSentryEndpoint({ ...packaged, dsn })).toEqual({ name: 'ENABLED', dsn });
  });

  test.each([
    ['no DSN', undefined, 'NO_DSN'],
    ['an empty DSN', '', 'NO_DSN'],
    ['text that is not a URL', 'not a dsn', 'INVALID_DSN'],
    ['a DSN without a public key', 'https://o42.ingest.de.sentry.io/4567', 'INVALID_DSN'],
    ['a DSN without a project number', 'https://abc@o42.ingest.de.sentry.io/project', 'INVALID_DSN'],
    ['a DSN without a project', 'https://abc@o42.ingest.de.sentry.io', 'INVALID_DSN'],
    ['a plain http DSN', 'http://abc@o42.ingest.de.sentry.io/4567', 'INVALID_DSN'],
    ['another scheme', 'ftp://abc@o42.ingest.de.sentry.io/4567', 'INVALID_DSN'],
  ])('refuses %s in a packaged build', (_label, dsn, reason) => {
    // Act, Assert
    expect(resolveSentryEndpoint({ ...packaged, dsn })).toEqual({ name: 'DISABLED', reason });
  });

  test('sends nothing from a development build, even with a DSN', () => {
    // Act, Assert
    expect(resolveSentryEndpoint({ ...packaged, isPackaged: false })).toEqual({ name: 'DISABLED', reason: 'DEVELOPMENT' });
  });

  describe('in an end-to-end run', () => {
    const e2e: SentryConfig = { ...packaged, isE2E: true };

    test('sends nothing without a stub, even with a DSN', () => {
      // Act, Assert
      expect(resolveSentryEndpoint(e2e)).toEqual({ name: 'DISABLED', reason: 'E2E' });
    });

    test('sends to a local stub over plain http', () => {
      // Arrange
      const override = 'http://key@127.0.0.1:4000/1';

      // Act, Assert
      expect(resolveSentryEndpoint({ ...e2e, override })).toEqual({ name: 'ENABLED', dsn: override });
    });

    test('refuses a stub that is not a DSN', () => {
      // Act, Assert
      expect(resolveSentryEndpoint({ ...e2e, override: 'http://127.0.0.1:4000' })).toEqual({ name: 'DISABLED', reason: 'E2E' });
    });

    test('uses the stub in an unpackaged run too', () => {
      // Act
      const endpoint = resolveSentryEndpoint({ ...e2e, isPackaged: false, override: 'http://key@127.0.0.1:4000/1' });

      // Assert
      expect(endpoint.name).toBe('ENABLED');
    });
  });

  test('ignores a stub outside an end-to-end run', () => {
    // Act
    const endpoint = resolveSentryEndpoint({ ...packaged, dsn: undefined, override: 'http://key@127.0.0.1:4000/1' });

    // Assert
    expect(endpoint).toEqual({ name: 'DISABLED', reason: 'NO_DSN' });
  });
});
