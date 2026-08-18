import { describe, expect, test } from 'vitest';
import { toRiverItems } from './river';
import type { Feed } from '../../preload/channels';

type FeedItem = Feed['items'][number];

function createFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  return {
    id: 1,
    feed_id: 1,
    title: 'Item',
    link: 'https://example.com/item',
    pubDate: '2024-01-01',
    description: '',
    image: undefined,
    ...overrides,
  };
}

function createFeed(overrides: Partial<Feed> = {}): Feed {
  return {
    id: 1,
    link: 'https://example.com/feed',
    title: 'Feed',
    category_id: 1,
    showInHome: 1,
    category: { id: 1, name: 'Tech' },
    items: [],
    ...overrides,
  };
}

describe('toRiverItems', () => {
  test('strips markup from the description', () => {
    // Arrange
    const feed = createFeed({ items: [createFeedItem({ description: '<p>Hello <strong>world</strong></p>' })] });

    // Act
    const [result] = toRiverItems([feed]);

    // Assert
    expect(result?.description).toBe('Hello world');
  });

  test('strips style tag content out of the description', () => {
    // Arrange: Blogger/Blogspot Atom feeds embed a <style> block ahead of the article body.
    const description = '<style>@media (max-width: 600px) { .body { overflow-x: auto; } }</style><p>Actual excerpt.</p>';
    const feed = createFeed({ items: [createFeedItem({ description })] });

    // Act
    const [result] = toRiverItems([feed]);

    // Assert
    expect(result?.description).toBe('Actual excerpt.');
  });

  test('strips script tag content out of the description', () => {
    // Arrange
    const description = '<script>alert(1)</script><p>Actual excerpt.</p>';
    const feed = createFeed({ items: [createFeedItem({ description })] });

    // Act
    const [result] = toRiverItems([feed]);

    // Assert
    expect(result?.description).toBe('Actual excerpt.');
  });
});
