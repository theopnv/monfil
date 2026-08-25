import { describe, expect, test } from 'vitest';
import { feedVisibility, folderVisibility, nextVisibility, visibleFeedLinks } from './feed-visibility';
import type { Feed } from '../../../preload/channels';

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

describe('feedVisibility', () => {
  test('a feed with showInHome unset and not in showOnlyLinks is home', () => {
    // Arrange
    const feed = createFeed();

    // Act & Assert
    expect(feedVisibility(feed, new Set())).toBe('home');
  });

  test('a feed whose link is in showOnlyLinks is only', () => {
    // Arrange
    const feed = createFeed({ link: 'https://a.example/feed' });

    // Act & Assert
    expect(feedVisibility(feed, new Set(['https://a.example/feed']))).toBe('only');
  });

  test('a feed with showInHome = 0 is hidden', () => {
    // Arrange
    const feed = createFeed({ showInHome: 0 });

    // Act & Assert
    expect(feedVisibility(feed, new Set())).toBe('hidden');
  });

  test('hidden wins over only when both stores disagree', () => {
    // Arrange
    const feed = createFeed({ link: 'https://a.example/feed', showInHome: 0 });

    // Act & Assert
    expect(feedVisibility(feed, new Set(['https://a.example/feed']))).toBe('hidden');
  });
});

describe('nextVisibility', () => {
  test('home rotates to only', () => {
    expect(nextVisibility('home')).toBe('only');
  });

  test('only rotates to hidden', () => {
    expect(nextVisibility('only')).toBe('hidden');
  });

  test('hidden rotates to home', () => {
    expect(nextVisibility('hidden')).toBe('home');
  });

  test('mixed resets to home', () => {
    expect(nextVisibility('mixed')).toBe('home');
  });
});

describe('folderVisibility', () => {
  test('an empty folder is home', () => {
    expect(folderVisibility([], new Set())).toBe('home');
  });

  test('a folder whose feeds share a state returns that state', () => {
    // Arrange
    const feeds = [createFeed({ showInHome: 0 }), createFeed({ id: 2, link: 'https://b.example/feed', showInHome: 0 })];

    // Act & Assert
    expect(folderVisibility(feeds, new Set())).toBe('hidden');
  });

  test('a folder whose feeds disagree is mixed', () => {
    // Arrange
    const feeds = [createFeed({ showInHome: 1 }), createFeed({ id: 2, link: 'https://b.example/feed', showInHome: 0 })];

    // Act & Assert
    expect(folderVisibility(feeds, new Set())).toBe('mixed');
  });
});

describe('visibleFeedLinks', () => {
  test('an empty feed list yields an empty set', () => {
    expect(visibleFeedLinks([], new Set())).toEqual(new Set());
  });

  test('with no only feeds, every non-hidden feed is visible', () => {
    // Arrange
    const feeds = [
      createFeed({ link: 'https://a.example/feed' }),
      createFeed({ id: 2, link: 'https://b.example/feed', showInHome: 0 }),
    ];

    // Act & Assert
    expect(visibleFeedLinks(feeds, new Set())).toEqual(new Set(['https://a.example/feed']));
  });

  test('with an only feed, just the only feeds are visible', () => {
    // Arrange
    const feeds = [
      createFeed({ link: 'https://a.example/feed' }),
      createFeed({ id: 2, link: 'https://b.example/feed' }),
    ];

    // Act & Assert
    expect(visibleFeedLinks(feeds, new Set(['https://a.example/feed']))).toEqual(new Set(['https://a.example/feed']));
  });

  test('an only feed that is also hidden contributes nothing', () => {
    // Arrange
    const feeds = [createFeed({ link: 'https://a.example/feed', showInHome: 0 })];

    // Act & Assert
    expect(visibleFeedLinks(feeds, new Set(['https://a.example/feed']))).toEqual(new Set());
  });
});
