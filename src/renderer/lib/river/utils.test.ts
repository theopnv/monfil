import { describe, expect, test } from 'vitest';
import { describeRiverCard, estimateReadTime, formatRelativeTime } from './utils';
import type { RiverRow } from '../../../preload/channels';

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
