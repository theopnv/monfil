// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { describeRiverCard, estimateReadTime, formatRelativeTime } from './utils';
import type { RiverRow } from '../../../shared/contracts';

function createRow(overrides: Partial<RiverRow> = {}): RiverRow {
  return {
    id: 1,
    title: 'Item',
    link: 'https://example.com/item',
    publishedAt: Date.now(),
    excerpt: '',
    feedTitle: 'Feed',
    feedLink: 'https://example.com/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    image: undefined,
    readAt: undefined,
    feedId: 1,
    type: 'rss',
    ...overrides,
  };
}

describe('formatRelativeTime boundaries', () => {
  const NOW = Date.UTC(2026, 5, 15, 12, 0, 0);
  const MINUTE = 60 * 1000;
  const HOUR = 60 * MINUTE;
  const DAY = 24 * HOUR;

  beforeEach(() => {
    vi.useFakeTimers({ now: NOW });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test.each([
    { label: 'one minute', age: MINUTE, expected: '1m' },
    { label: 'one hour', age: HOUR, expected: '1h' },
    { label: 'one day', age: DAY, expected: '1d' },
    { label: 'six days and 23 hours', age: 7 * DAY - HOUR, expected: '6d' },
  ])('$label old reads $expected', ({ age, expected }) => {
    // Act
    const result = formatRelativeTime(NOW - age);

    // Assert
    expect(result).toBe(expected);
  });

  test('exactly one week old is a locale date', () => {
    // Act
    const result = formatRelativeTime(NOW - 7 * DAY);

    // Assert
    expect(result).toBe(new Date(NOW - 7 * DAY).toLocaleDateString());
  });
});

describe('formatRelativeTime', () => {
  test('shows "now" for the current moment', () => {
    // Act
    const result = formatRelativeTime(Date.now());

    // Assert
    expect(result).toBe('now');
  });

  test('shows minutes for under an hour', () => {
    // Act
    const result = formatRelativeTime(Date.now() - 5 * 60 * 1000);

    // Assert
    expect(result).toBe('5m');
  });

  test('shows hours for under a day', () => {
    // Act
    const result = formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000);

    // Assert
    expect(result).toBe('3h');
  });

  test('shows days for under a week', () => {
    // Act
    const result = formatRelativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000);

    // Assert
    expect(result).toBe('2d');
  });

  test('falls back to a locale date at a week or older', () => {
    // Arrange
    const timestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;

    // Act
    const result = formatRelativeTime(timestamp);

    // Assert
    expect(result).toBe(new Date(timestamp).toLocaleDateString());
  });
});

describe('describeRiverCard', () => {
  test('mentions the title, read state and feed', () => {
    // Arrange
    const row = createRow({ title: 'A headline', feedTitle: 'Feed A', publishedAt: Date.now() });

    // Act
    const result = describeRiverCard(row, false);

    // Assert
    expect(result).toBe(`A headline, unread, from Feed A, ${formatRelativeTime(row.publishedAt)}.`);
  });

  test('says read for a read item', () => {
    // Arrange
    const row = createRow({ title: 'A headline', feedTitle: 'Feed A', publishedAt: Date.now() });

    // Act
    const result = describeRiverCard(row, true);

    // Assert
    expect(result).toBe(`A headline, read, from Feed A, ${formatRelativeTime(row.publishedAt)}.`);
  });
});

describe('estimateReadTime', () => {
  test('counts words in a description string', () => {
    // Act
    const result = estimateReadTime('word '.repeat(400).trim());

    // Assert
    expect(result).toBe('2 min read');
  });

  test('follows a given word count directly, without touching the description', () => {
    // Act
    const result = estimateReadTime(1000);

    // Assert
    expect(result).toBe('5 min read');
  });

  test('rounds up to a minimum of 1 minute', () => {
    // Act
    const result = estimateReadTime('short description');

    // Assert
    expect(result).toBe('1 min read');
  });
});
