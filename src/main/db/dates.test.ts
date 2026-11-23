// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { hasPublishedDate, publishedAtOrFallback } from './dates';

describe('publishedAtOrFallback', () => {

  test.each([ 'invalid-date', 'yesterday'])('uses the fallback for %j', (pubDate) => {
    // Act & Assert
    expect(publishedAtOrFallback(pubDate, 5)).toBe(5);
  });
});

describe('hasPublishedDate', () => {
  test('tells a date from text that is not one', () => {
    // Act & Assert
    expect(hasPublishedDate('2026-03-01T10:00:00Z')).toBe(true);
    expect(hasPublishedDate('invalid-date')).toBe(false);
    expect(hasPublishedDate('')).toBe(false);
  });
});
