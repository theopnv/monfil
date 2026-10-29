// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { computeFeedContentType, computePublishRate } from './feedStats';

describe('computePublishRate', () => {
  test('returns "New" for an empty feed', () => {
    // Act
    const result = computePublishRate([]);

    // Assert
    expect(result).toBe('New');
  });

  test('returns the raw item count when there are not enough dates to span a range', () => {
    // Arrange
    const items = [{ pubDate: '2024-01-01', description: '' }];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('1');
  });

  test('computes a whole-number per-day rate over the date range', () => {
    // Arrange: earliest and latest pubDate are 2 days apart, 4 items total = 2/day
    const items = [
      { pubDate: '2024-01-01T00:00:00.000Z', description: '' },
      { pubDate: '2024-01-01T12:00:00.000Z', description: '' },
      { pubDate: '2024-01-02T12:00:00.000Z', description: '' },
      { pubDate: '2024-01-03T00:00:00.000Z', description: '' },
    ];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('~2/day');
  });

  test('falls back to a per-week rate when the per-day rate is under 1', () => {
    // Arrange: 3 items over a 14-day span = 0.214/day, ~1.5/week -> rounds to 2/week
    const items = [
      { pubDate: new Date(2024, 0, 1).toISOString(), description: '' },
      { pubDate: new Date(2024, 0, 8).toISOString(), description: '' },
      { pubDate: new Date(2024, 0, 15).toISOString(), description: '' },
    ];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('~2/week');
  });

  test('falls back to a per-month rate when the per-week rate is under 1', () => {
    // Arrange: 2 items 90 days apart = ~0.02/day, well under 1/week
    const items = [
      { pubDate: new Date(2024, 0, 1).toISOString(), description: '' },
      { pubDate: new Date(2024, 3, 1).toISOString(), description: '' },
    ];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('~1/month');
  });

  test('ignores items whose date cannot be read', () => {
    // Arrange
    const items = [
      { pubDate: '2024-01-01T00:00:00.000Z', description: '' },
      { pubDate: 'not a date', description: '' },
    ];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('2');
  });

  test('reports exactly one item a day as a per-day rate', () => {
    // Arrange
    const items = [
      { pubDate: '2024-01-01T00:00:00.000Z', description: '' },
      { pubDate: '2024-01-03T00:00:00.000Z', description: '' },
    ];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('~1/day');
  });

  test('reports exactly one item a week as a per-week rate', () => {
    // Arrange
    const items = [
      { pubDate: '2024-01-01T00:00:00.000Z', description: '' },
      { pubDate: '2024-01-15T00:00:00.000Z', description: '' },
    ];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('~1/week');
  });

  test('scales a slow feed to items a month', () => {
    // Arrange: 7 items over 100 days = 2.1 a month
    const items = Array.from({ length: 7 }, (_, index) => ({
      pubDate: new Date(Date.UTC(2024, 0, 1) + index * (100 / 6) * 24 * 60 * 60 * 1000).toISOString(),
      description: '',
    }));

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('~2/month');
  });

  test('never reports fewer than one item a month', () => {
    // Arrange
    const items = [
      { pubDate: '2024-01-01T00:00:00.000Z', description: '' },
      { pubDate: '2025-01-01T00:00:00.000Z', description: '' },
    ];

    // Act
    const result = computePublishRate(items);

    // Assert
    expect(result).toBe('~1/month');
  });
});

describe('computeFeedContentType', () => {
  test('returns "Excerpt" for an empty feed', () => {
    // Act
    const result = computeFeedContentType([]);

    // Assert
    expect(result).toBe('Excerpt');
  });

  test('returns "Excerpt" when descriptions are short', () => {
    // Arrange
    const items = [{ pubDate: '2024-01-01', description: 'A short summary.' }];

    // Act
    const result = computeFeedContentType(items);

    // Assert
    expect(result).toBe('Excerpt');
  });

  test('returns "Full text" when descriptions are long on average', () => {
    // Arrange
    const items = [{ pubDate: '2024-01-01', description: 'x'.repeat(500) }];

    // Act
    const result = computeFeedContentType(items);

    // Assert
    expect(result).toBe('Full text');
  });

  test('uses the average length, not the total', () => {
    // Arrange
    const items = [
      { pubDate: '2024-01-01', description: 'x'.repeat(150) },
      { pubDate: '2024-01-02', description: 'x'.repeat(150) },
    ];

    // Act
    const result = computeFeedContentType(items);

    // Assert
    expect(result).toBe('Excerpt');
  });

  test('treats an average of exactly 400 characters as full text', () => {
    // Arrange
    const items = [{ pubDate: '2024-01-01', description: 'x'.repeat(400) }];

    // Act
    const result = computeFeedContentType(items);

    // Assert
    expect(result).toBe('Full text');
  });
});
