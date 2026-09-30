// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { redact, serializeError } from './logger';

describe('log redaction', () => {
  test('removes sensitive fields and keeps identifiers', () => {
    // Arrange
    const record = { feedId: 42, feedName: 'Private feed', url: 'https://user:secret@example.com/private', count: 3 };

    // Act
    const result = redact(record);

    // Assert
    expect(result).toEqual({ feedId: 42, feedName: '[redacted]', url: '[redacted]', count: 3 });
  });

  test('removes paths from error text', () => {
    // Arrange
    const sensitivePath = ['', 'Users', 'person', 'Library', 'Application Support', 'monfil', 'data.db'].join('/');
    const message = `Failed at ${sensitivePath}`;

    // Act
    const result = redact(message);

    // Assert
    expect(result).not.toContain(sensitivePath);
  });
});

describe('log errors', () => {
  test('serializes a tagged error object', () => {
    // Arrange
    const error = { name: 'NETWORK_ERROR', message: 'Could not resolve example.com.' };

    // Act
    const result = serializeError(error);

    // Assert
    expect(result).toEqual(error);
  });
});
