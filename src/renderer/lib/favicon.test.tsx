import { describe, expect, test } from 'vitest';
import { getFaviconUrl, resolveFeedIcon } from './favicon';

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

  test('returns the root domain favicon path for a subdomain link', () => {
    // Act
    const result = getFaviconUrl('https://sub.example.com/blog');

    // Assert
    expect(result).toBe('https://example.com/favicon.ico');
  });
});

describe('resolveFeedIcon', () => {
  test('prefers the stored icon over the favicon fallback', () => {
    // Act
    const result = resolveFeedIcon('https://yt3.googleusercontent.com/avatar=s176', 'https://example.com/feed');

    // Assert
    expect(result).toBe('https://yt3.googleusercontent.com/avatar=s176');
  });

  test('falls back to the favicon when there is no stored icon', () => {
    // Act
    const result = resolveFeedIcon(undefined, 'https://example.com/feed');

    // Assert
    expect(result).toBe('https://example.com/favicon.ico');
  });

  test('returns undefined when there is no icon and the link is malformed', () => {
    // Act
    const result = resolveFeedIcon(undefined, 'not a url');

    // Assert
    expect(result).toBeUndefined();
  });
});
