import { describe, expect, test } from 'vitest';
import { getFaviconUrl } from './favicon';

describe('getFaviconUrl', () => {
  test('returns the origin favicon path for a normal link', () => {
    // Act
    const result = getFaviconUrl('https://example.com/blog');

    // Assert
    expect(result).toBe('https://example.com/favicon.ico');
  });

  test('strips path and query from the feed URL', () => {
    // Act
    const result = getFaviconUrl('https://example.com/blog/feed.xml?x=1');

    // Assert
    expect(result).toBe('https://example.com/favicon.ico');
  });

  test('returns undefined for undefined input', () => {
    // Act
    const result = getFaviconUrl(undefined);

    // Assert
    expect(result).toBeUndefined();
  });

  test('returns undefined for an empty string', () => {
    // Act
    const result = getFaviconUrl('');

    // Assert
    expect(result).toBeUndefined();
  });

  test('returns undefined for a malformed URL', () => {
    // Act
    const result = getFaviconUrl('not a url');

    // Assert
    expect(result).toBeUndefined();
  });
});
