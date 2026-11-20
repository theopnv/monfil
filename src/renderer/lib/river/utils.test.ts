// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { i18n } from '@/lib/i18n';
import { describeRiverCard, estimateReadTime, formatRelativeTime, sourceTypeLabel } from './utils';
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
    const result = formatRelativeTime(NOW - age, 'en');

    // Assert
    expect(result).toBe(expected);
  });

  test('exactly one week old is a date', () => {
    // Act
    const result = formatRelativeTime(NOW - 7 * DAY, 'en');

    // Assert
    expect(result).toBe('6/8/2026');
  });
});

describe('formatRelativeTime in other locales', () => {
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
    { locale: 'fr', expected: 'maintenant' },
    { locale: 'de', expected: 'jetzt' },
    { locale: 'zh-Hans', expected: '现在' },
    { locale: 'ja', expected: '今' },
    { locale: 'ar', expected: 'الآن' },
  ])('says "now" in $locale', ({ locale, expected }) => {
    // Act
    const result = formatRelativeTime(NOW, locale);

    // Assert
    expect(result).toBe(expected);
  });

  test('writes the units in the locale', () => {
    // Act
    const result = [NOW - 3 * HOUR, NOW - 2 * DAY].map((publishedAt) => formatRelativeTime(publishedAt, 'zh-Hans'));

    // Assert
    expect(result).toEqual(['3小时', '2天']);
  });

  test.each([
    { locale: 'de', expected: '8.6.2026' },
    { locale: 'fr', expected: '08/06/2026' },
    { locale: 'zh-Hans', expected: '2026/6/8' },
  ])('writes a date from a week on in the order of $locale', ({ locale, expected }) => {
    // Act
    const result = formatRelativeTime(NOW - 7 * DAY, locale);

    // Assert
    expect(result).toBe(expected);
  });

  test('keeps each locale apart after it has been used once', () => {
    // Act
    const first = formatRelativeTime(NOW, 'fr');
    const second = formatRelativeTime(NOW, 'en');
    const third = formatRelativeTime(NOW, 'fr');

    // Assert
    expect([first, second, third]).toEqual(['maintenant', 'now', 'maintenant']);
  });
});

describe('formatRelativeTime', () => {
  test('shows "now" for the current moment', () => {
    // Act
    const result = formatRelativeTime(Date.now(), 'en');

    // Assert
    expect(result).toBe('now');
  });

  test('shows minutes for under an hour', () => {
    // Act
    const result = formatRelativeTime(Date.now() - 5 * 60 * 1000, 'en');

    // Assert
    expect(result).toBe('5m');
  });

  test('shows hours for under a day', () => {
    // Act
    const result = formatRelativeTime(Date.now() - 3 * 60 * 60 * 1000, 'en');

    // Assert
    expect(result).toBe('3h');
  });

  test('shows days for under a week', () => {
    // Act
    const result = formatRelativeTime(Date.now() - 2 * 24 * 60 * 60 * 1000, 'en');

    // Assert
    expect(result).toBe('2d');
  });

  test('falls back to a date at a week or older', () => {
    // Arrange
    const timestamp = Date.now() - 10 * 24 * 60 * 60 * 1000;

    // Act
    const result = formatRelativeTime(timestamp, 'en');

    // Assert
    const date = new Date(timestamp);
    expect(result).toBe(`${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`);
  });
});

const t = i18n.getFixedT('en', 'river');

describe('sourceTypeLabel', () => {
  test.each([
    ['rss', 'RSS'],
    ['youtube', 'YOUTUBE'],
    ['hackernews', 'HN'],
    ['conference', 'CONF'],
    ['ats', 'JOB'],
  ] as const)('labels %s as %s', (type, expected) => {
    // Act
    const result = sourceTypeLabel(type, t);

    // Assert
    expect(result).toBe(expected);
  });
});

describe('describeRiverCard', () => {
  test('mentions the title, read state and feed', () => {
    // Arrange
    const row = createRow({ title: 'A headline', feedTitle: 'Feed A', publishedAt: Date.now() });

    // Act
    const result = describeRiverCard(row, false, t, formatRelativeTime(row.publishedAt, 'en'));

    // Assert
    expect(result).toBe(`A headline, unread, from Feed A, ${formatRelativeTime(row.publishedAt, 'en')}.`);
  });

  test('says read for a read item', () => {
    // Arrange
    const row = createRow({ title: 'A headline', feedTitle: 'Feed A', publishedAt: Date.now() });

    // Act
    const result = describeRiverCard(row, true, t, formatRelativeTime(row.publishedAt, 'en'));

    // Assert
    expect(result).toBe(`A headline, read, from Feed A, ${formatRelativeTime(row.publishedAt, 'en')}.`);
  });
});

describe('estimateReadTime', () => {
  test('counts words in a description string', () => {
    // Act
    const result = estimateReadTime('word '.repeat(400).trim(), t);

    // Assert
    expect(result).toBe('2 min read');
  });

  test('follows a given word count directly, without touching the description', () => {
    // Act
    const result = estimateReadTime(1000, t);

    // Assert
    expect(result).toBe('5 min read');
  });

  test('counts Chinese and Japanese characters, not spaces', () => {
    // Act
    const chinese = estimateReadTime('今'.repeat(800), t);
    const japanese = estimateReadTime('あ'.repeat(2000), t);

    // Assert
    expect(chinese).toBe('2 min read');
    expect(japanese).toBe('5 min read');
  });

  test('rounds up to a minimum of 1 minute', () => {
    // Act
    const result = estimateReadTime('short description', t);

    // Assert
    expect(result).toBe('1 min read');
  });
});
