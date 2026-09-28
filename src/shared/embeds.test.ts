import { describe, expect, test } from 'vitest';
import { resolveEmbedUrl } from './embeds';

describe('resolveEmbedUrl', () => {
  test.each([
    ['https://www.youtube.com/embed/5HcjtbfJfCY', 'youtube', 'https://www.youtube-nocookie.com/embed/5HcjtbfJfCY'],
    ['https://twitter.com/JeremyNoronha/status/2103860923295281612', 'x', 'https://platform.twitter.com/embed/Tweet.html?id=2103860923295281612'],
    ['https://platform.twitter.com/embed/Tweet.html?id=2103860923295281612', 'x', 'https://platform.twitter.com/embed/Tweet.html?id=2103860923295281612'],
    ['https://vimeo.com/12345678', 'vimeo', 'https://player.vimeo.com/video/12345678'],
    ['https://www.instagram.com/p/Cx123456789/', 'instagram', 'https://www.instagram.com/p/Cx123456789/embed/'],
    ['https://open.spotify.com/track/0Lr4kGOYn9l83EjuK6cZFQ', 'spotify', 'https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ'],
    ['https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ', 'spotify', 'https://open.spotify.com/embed/track/0Lr4kGOYn9l83EjuK6cZFQ'],
  ] as const)('resolves %s', (url, provider, frameUrl) => {
    // Act
    const result = resolveEmbedUrl(url);

    // Assert
    expect(result).toMatchObject({ provider, frameUrl });
  });

  test.each([
    'http://www.youtube.com/watch?v=5HcjtbfJfCY',
    'https://www.youtube.com.evil.example/embed/5HcjtbfJfCY',
    'https://www.youtube.com/embed/invalid',
    'javascript:alert(1)',
    'https://example.com/embed/5HcjtbfJfCY',
  ])('rejects %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });
});
