import { describe, expect, test } from 'vitest';
import { deriveStandfirst, findRawDescription, getReaderNavigation, renderPlainTextDescription } from './reader';
import type { Feed } from '../../../preload/channels';
import type { RiverItem } from '../river/utils';

function createItem(overrides: Partial<RiverItem> = {}): RiverItem {
  return {
    id: 1,
    title: 'Item title',
    link: 'https://example.com/item',
    pubDate: '2024-01-01',
    description: 'Item description',
    feedTitle: 'Feed',
    feedLink: 'https://example.com/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    image: undefined,
    type: 'rss',
    ...overrides,
  };
}

describe('getReaderNavigation', () => {
  const items = [createItem({ id: 1 }), createItem({ id: 2 }), createItem({ id: 3 })];
  const neverRead = () => false;

  test('a mid-list item has both a previous and a next neighbor', () => {
    // Act
    const result = getReaderNavigation(items, 2, neverRead);

    // Assert
    expect(result.previous?.id).toBe(1);
    expect(result.next?.id).toBe(3);
  });

  test('the first item has no previous neighbor', () => {
    // Act
    const result = getReaderNavigation(items, 1, neverRead);

    // Assert
    expect(result.previous).toBeUndefined();
    expect(result.next?.id).toBe(2);
  });

  test('the last item has no next neighbor', () => {
    // Act
    const result = getReaderNavigation(items, 3, neverRead);

    // Assert
    expect(result.next).toBeUndefined();
    expect(result.previous?.id).toBe(2);
  });

  test('nextUnread skips already-read items ahead in the order', () => {
    // Arrange
    const isRead = (id: number) => id === 2;

    // Act
    const result = getReaderNavigation(items, 1, isRead);

    // Assert
    expect(result.nextUnread?.id).toBe(3);
  });

  test('nextUnread falls back to the plain next item when everything ahead is read', () => {
    // Arrange
    const isRead = (id: number) => id === 2 || id === 3;

    // Act
    const result = getReaderNavigation(items, 1, isRead);

    // Assert
    expect(result.nextUnread?.id).toBe(2);
  });

  test('an unknown currentId returns undefined for every field', () => {
    // Act
    const result = getReaderNavigation(items, 999, neverRead);

    // Assert
    expect(result).toEqual({ previous: undefined, next: undefined, nextUnread: undefined });
  });
});

describe('deriveStandfirst', () => {
  test('passes short text through unchanged', () => {
    // Act
    const result = deriveStandfirst('A short description.');

    // Assert
    expect(result).toBe('A short description.');
  });

  test('truncates long text at a word boundary', () => {
    // Arrange
    const text = 'word '.repeat(60).trim();

    // Act
    const result = deriveStandfirst(text, 22);

    // Assert
    expect(result).toBe('word word word word…');
  });

  test('returns undefined for empty input', () => {
    // Act
    const result = deriveStandfirst('   ');

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('renderPlainTextDescription', () => {
  test('escapes html-significant characters', () => {
    // Act
    const result = renderPlainTextDescription('<script>alert("hi")</script> & friends');

    // Assert
    expect(result).toBe('&lt;script&gt;alert(&quot;hi&quot;)&lt;/script&gt; &amp; friends');
  });

  test('wraps a bare url in an anchor', () => {
    // Act
    const result = renderPlainTextDescription('Watch: https://example.com/video for more.');

    // Assert
    expect(result).toBe('Watch: <a href="https://example.com/video">https://example.com/video</a> for more.');
  });

  test('excludes trailing sentence punctuation from the link', () => {
    // Act
    const result = renderPlainTextDescription('See https://example.com/video.');

    // Assert
    expect(result).toBe('See <a href="https://example.com/video">https://example.com/video</a>.');
  });

  test('replaces newlines with line breaks', () => {
    // Act
    const result = renderPlainTextDescription('Line one\nLine two');

    // Assert
    expect(result).toBe('Line one<br>Line two');
  });
});

describe('findRawDescription', () => {
  const feeds: Feed[] = [
    {
      id: 1,
      link: 'https://a.example/feed',
      title: 'Feed A',
      category_id: 1,
      type: 'rss',
      showInHome: 1,
      last_fetched_at: undefined,
      last_error: undefined,
      icon: undefined,
      category: { id: 1, name: 'Tech' },
      items: [{ id: 10, feed_id: 1, title: 'Item', link: 'https://a.example/item', guid: 'https://a.example/item', pubDate: '2024-01-01', description: '<p>raw html</p>', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
    },
  ];

  test('returns the raw description for a matching item id', () => {
    // Act
    const result = findRawDescription(feeds, 10);

    // Assert
    expect(result).toBe('<p>raw html</p>');
  });

  test('returns undefined when no item matches', () => {
    // Act
    const result = findRawDescription(feeds, 999);

    // Assert
    expect(result).toBeUndefined();
  });
});
