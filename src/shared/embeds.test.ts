// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { resolveEmbedUrl } from './embeds';

const YT = '5HcjtbfJfCY';
const TWEET = '2103860923295281612';
const SPOTIFY = '0Lr4kGOYn9l83EjuK6cZFQ';

describe('resolveEmbedUrl', () => {

  test('resolves a relative input against the base URL', () => {
    // Act
    const result = resolveEmbedUrl('/embed/5HcjtbfJfCY', 'https://www.youtube.com/some/page');

    // Assert
    expect(result).toEqual({
      provider: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=5HcjtbfJfCY',
      frameUrl: 'https://www.youtube-nocookie.com/embed/5HcjtbfJfCY',
    });
  });

  test.each([
    'ftp://vimeo.com/12345678',
  ])('rejects the non-https URL %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });
});

describe('resolveEmbedUrl for YouTube', () => {
  const expected = {
    provider: 'youtube',
    sourceUrl: `https://www.youtube.com/watch?v=${YT}`,
    frameUrl: `https://www.youtube-nocookie.com/embed/${YT}`,
  };

  test.each([
    `https://youtube.com/watch?v=${YT}`,
    `https://www.youtube.com/watch?v=${YT}`,
    `https://m.youtube.com/watch?v=${YT}`,
    `https://www.youtube-nocookie.com/watch?v=${YT}`,
    `https://www.youtube.com/watch?feature=share&v=${YT}`,
    `https://www.youtube.com/embed/${YT}`,
    `https://www.youtube.com/shorts/${YT}`,
    `https://www.youtube.com/live/${YT}`,
    `https://youtube.com/embed/${YT}`,
    `https://m.youtube.com/shorts/${YT}`,
    `https://www.youtube-nocookie.com/embed/${YT}`,
    `https://youtube-nocookie.com/embed/${YT}`,
    `https://youtu.be/${YT}`,
    `https://youtu.be/${YT}?t=10`,
  ])('resolves %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toEqual(expected);
  });

  test('resolves an uppercase host', () => {
    // Act & Assert
    expect(resolveEmbedUrl(`https://WWW.YouTube.com/embed/${YT}`)).toEqual(expected);
  });

  test('accepts underscores and dashes in the ID', () => {
    // Act
    const result = resolveEmbedUrl('https://youtu.be/a_b-c_d-e_f');

    // Assert
    expect(result).toEqual({
      provider: 'youtube',
      sourceUrl: 'https://www.youtube.com/watch?v=a_b-c_d-e_f',
      frameUrl: 'https://www.youtube-nocookie.com/embed/a_b-c_d-e_f',
    });
  });

  test.each([
    `https://youtube.com.evil.example/watch?v=${YT}`,
  ])('rejects the near-miss host in %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });

  test.each([
    ['one character too long', 'a'.repeat(12)],
  ])('rejects an ID %s', (_name, id) => {
    // Act & Assert
    expect(resolveEmbedUrl(`https://www.youtube.com/watch?v=${encodeURIComponent(id)}`)).toBeUndefined();
    expect(resolveEmbedUrl(`https://www.youtube.com/embed/${encodeURIComponent(id)}`)).toBeUndefined();
    expect(resolveEmbedUrl(`https://youtu.be/${encodeURIComponent(id)}`)).toBeUndefined();
  });

  test.each([
    `https://www.youtube.com/user/${YT}`,
  ])('rejects the URL shape %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });

  test.each([
    `https://youtu.be/embed/${YT}`,
    `https://youtu.be/watch?v=${YT}`,
  ])('does not read the watch or embed shape on youtu.be: %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });

  test('ignores the v parameter on an embed path', () => {
    // Act
    const result = resolveEmbedUrl(`https://www.youtube.com/embed/${YT}?v=aaaaaaaaaaa`);

    // Assert
    expect(result?.sourceUrl).toBe(`https://www.youtube.com/watch?v=${YT}`);
  });
});

describe('resolveEmbedUrl for X', () => {
  test.each([
    'https://x.com',
    'https://www.x.com',
    'https://twitter.com',
    'https://www.twitter.com',
    'https://mobile.twitter.com',
  ])('resolves a status URL on %s', (origin) => {
    // Act
    const result = resolveEmbedUrl(`${origin}/JeremyNoronha/status/${TWEET}`);

    // Assert
    expect(result).toEqual({
      provider: 'x',
      sourceUrl: `https://x.com/JeremyNoronha/status/${TWEET}`,
      frameUrl: `https://platform.twitter.com/embed/Tweet.html?id=${TWEET}`,
    });
  });

  test('resolves the platform embed URL with a generic author', () => {
    // Act
    const result = resolveEmbedUrl(`https://platform.twitter.com/embed/Tweet.html?id=${TWEET}&theme=dark`);

    // Assert
    expect(result).toEqual({
      provider: 'x',
      sourceUrl: `https://x.com/i/status/${TWEET}`,
      frameUrl: `https://platform.twitter.com/embed/Tweet.html?id=${TWEET}`,
    });
  });

  test.each([
    'https://nottwitter.com',
  ])('rejects the near-miss host %s', (origin) => {
    // Act & Assert
    expect(resolveEmbedUrl(`${origin}/jack/status/${TWEET}`)).toBeUndefined();
  });

  test.each([
    ['at the lower bound', '12345', true],
    ['at the upper bound', '1'.repeat(25), true],
    ['one digit too long', '1'.repeat(26), false],
  ])('checks a tweet ID %s on a status URL', (_name, id, accepted) => {
    // Act
    const result = resolveEmbedUrl(`https://x.com/jack/status/${id}`);

    // Assert
    expect(result?.sourceUrl).toBe(accepted ? `https://x.com/jack/status/${id}` : undefined);
  });

  test.each([
    ['at the lower bound', '12345', true],
    ['at the upper bound', '1'.repeat(25), true],
    ['one digit too long', '1'.repeat(26), false],
  ])('checks a tweet ID %s on the platform embed URL', (_name, id, accepted) => {
    // Act
    const result = resolveEmbedUrl(`https://platform.twitter.com/embed/Tweet.html?id=${id}`);

    // Assert
    expect(result?.frameUrl).toBe(accepted ? `https://platform.twitter.com/embed/Tweet.html?id=${id}` : undefined);
  });

  test.each([
    ['a single character', 'a', true],
    ['an underscore and digits', 'a_1', true],
    ['15 characters', 'a'.repeat(15), true],
    ['16 characters', 'a'.repeat(16), false],
    ['a dash', 'a-b', false],
    ['a leading dash', '-bob', false],
    ['a trailing dash', 'bob-', false],
    ['a dot', 'a.b', false],
  ])('checks the author name with %s', (_name, author, accepted) => {
    // Act
    const result = resolveEmbedUrl(`https://x.com/${author}/status/${TWEET}`);

    // Assert
    expect(result?.sourceUrl).toBe(accepted ? `https://x.com/${author}/status/${TWEET}` : undefined);
  });

  test.each([
    `https://x.com/jack/likes/${TWEET}`,
    `https://twitter.com/embed/Tweet.html?id=${TWEET}`,
    `https://platform.twitter.com/embed/Other.html?id=${TWEET}`,
    `https://platform.twitter.com/embed/Tweet.html/extra?id=${TWEET}`,
    `https://platform.twitter.com/jack/status/${TWEET}`,
  ])('rejects the URL shape %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });
});

describe('resolveEmbedUrl for Vimeo', () => {
  test.each([
    'https://vimeo.com/76979871',
    'https://www.vimeo.com/76979871',
    'https://player.vimeo.com/video/76979871',
    'https://vimeo.com/76979871?share=copy',
  ])('resolves %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toEqual({
      provider: 'vimeo',
      sourceUrl: 'https://vimeo.com/76979871',
      frameUrl: 'https://player.vimeo.com/video/76979871',
    });
  });

  test.each([
    ['one digit', '1', true],
    ['20 digits', '1'.repeat(20), true],
    ['21 digits', '1'.repeat(21), false],
    ['a dash', '12-3', false],
  ])('checks an ID with %s', (_name, id, accepted) => {
    // Act
    const viaPage = resolveEmbedUrl(`https://vimeo.com/${id}`);
    const viaPlayer = resolveEmbedUrl(`https://player.vimeo.com/video/${id}`);

    // Assert
    const frameUrl = accepted ? `https://player.vimeo.com/video/${id}` : undefined;
    expect(viaPage?.frameUrl).toBe(frameUrl);
    expect(viaPlayer?.frameUrl).toBe(frameUrl);
  });

  test.each([
    'https://api.vimeo.com/76979871',
    'https://vimeo.com/video/76979871',
    'https://www.vimeo.com/video/76979871',
    'https://player.vimeo.com/76979871',
    'https://player.vimeo.com/channels/76979871',
  ])('rejects %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });
});

describe('resolveEmbedUrl for Instagram', () => {
  test.each([
    ['https://instagram.com', 'p'],
    ['https://www.instagram.com', 'p'],
    ['https://www.instagram.com', 'reel'],
    ['https://www.instagram.com', 'tv'],
    ['https://instagram.com', 'reel'],
  ])('resolves a %s/%s URL', (origin, kind) => {
    // Act & Assert
    expect(resolveEmbedUrl(`${origin}/${kind}/Cx12_-3456/`)).toEqual({
      provider: 'instagram',
      sourceUrl: `https://www.instagram.com/${kind}/Cx12_-3456/`,
      frameUrl: `https://www.instagram.com/${kind}/Cx12_-3456/embed/`,
    });
  });

  test('resolves a URL without a trailing slash', () => {
    // Act & Assert
    expect(resolveEmbedUrl('https://www.instagram.com/reel/ABCDE')?.frameUrl).toBe('https://www.instagram.com/reel/ABCDE/embed/');
  });

  test.each([
    ['at the lower bound', 'a'.repeat(5), true],
    ['at the upper bound', 'a'.repeat(30), true],
    ['one character too long', 'a'.repeat(31), false],
  ])('checks a shortcode %s', (_name, id, accepted) => {
    // Act
    const result = resolveEmbedUrl(`https://www.instagram.com/p/${id}/`);

    // Assert
    expect(result?.frameUrl).toBe(accepted ? `https://www.instagram.com/p/${id}/embed/` : undefined);
  });

  test.each([
    'https://notinstagram.com/p/Cx123456789/',
    'https://www.instagram.com/explore/Cx123456789/',
  ])('rejects %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });
});

describe('resolveEmbedUrl for Spotify', () => {
  test.each(['track', 'album', 'playlist', 'episode', 'show', 'artist'])('resolves a %s URL in both shapes', (kind) => {
    // Arrange
    const expected = {
      provider: 'spotify',
      sourceUrl: `https://open.spotify.com/${kind}/${SPOTIFY}`,
      frameUrl: `https://open.spotify.com/embed/${kind}/${SPOTIFY}`,
    };

    // Act & Assert
    expect(resolveEmbedUrl(`https://open.spotify.com/${kind}/${SPOTIFY}`)).toEqual(expected);
    expect(resolveEmbedUrl(`https://open.spotify.com/embed/${kind}/${SPOTIFY}`)).toEqual(expected);
    expect(resolveEmbedUrl(`https://open.spotify.com/${kind}/${SPOTIFY}?si=abc`)).toEqual(expected);
  });

  test.each([
    ['23 characters', `${SPOTIFY}a`, false],
    ['22 alphanumeric characters', 'a1'.repeat(11), true],
  ])('checks an ID with %s', (_name, id, accepted) => {
    // Act
    const direct = resolveEmbedUrl(`https://open.spotify.com/track/${id}`);
    const embed = resolveEmbedUrl(`https://open.spotify.com/embed/track/${id}`);

    // Assert
    const frameUrl = accepted ? `https://open.spotify.com/embed/track/${id}` : undefined;
    expect(direct?.frameUrl).toBe(frameUrl);
    expect(embed?.frameUrl).toBe(frameUrl);
  });

  test.each([
    `https://notopen.spotify.com/track/${SPOTIFY}`,
    `https://open.spotify.com/embed/user/${SPOTIFY}`,
  ])('rejects %s', (url) => {
    // Act & Assert
    expect(resolveEmbedUrl(url)).toBeUndefined();
  });
});
