// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { isYoutubeLink, parseFeedContent, parseYoutubeInput, youtubeSource } from './youtube';
import { fetchConditional, fetchText } from '../../lib/fetch';
import type { FetchUrlError } from '../../../shared/contracts';

vi.mock(import('../../lib/fetch'), () => ({
  fetchConditional: vi.fn(),
  fetchText: vi.fn(),
}));

const mockedFetchConditional = vi.mocked(fetchConditional);
const mockedFetchText = vi.mocked(fetchText);
const fetchFeed = youtubeSource.fetch;

const CHANNEL_ID = 'UCWedHS9qKebauVIK2J7383g';
const AVATAR_RAW = 'https://yt3.googleusercontent.com/avatar=s900-c-k-c0x00ffffff-no-rj';
const AVATAR_NORMALIZED = 'https://yt3.googleusercontent.com/avatar=s176-c-k-c0x00ffffff-no-rj';

describe('parseYoutubeInput', () => {

  test('a youtu.be link with a list param resolves to a playlist', () => {
    expect(parseYoutubeInput('https://youtu.be/abc123?list=PL1')).toEqual({ kind: 'playlist', playlistId: 'PL1' });
  });

  test('a bare youtu.be link resolves to a video', () => {
    expect(parseYoutubeInput('https://youtu.be/abc123')).toEqual({ kind: 'video', videoId: 'abc123' });
  });

  test('a videos.xml link with playlist_id resolves to a playlist', () => {
    expect(parseYoutubeInput('https://www.youtube.com/feeds/videos.xml?playlist_id=PL1')).toEqual({ kind: 'playlist', playlistId: 'PL1' });
  });

  test('a /channel/ link resolves to a channel', () => {
    expect(parseYoutubeInput(`https://www.youtube.com/channel/${CHANNEL_ID}`)).toEqual({ kind: 'channel', channelId: CHANNEL_ID });
    expect(parseYoutubeInput(`https://www.youtube.com/channel/${CHANNEL_ID}/videos`)).toEqual({ kind: 'channel', channelId: CHANNEL_ID });
  });

  test('a /c/ link resolves to a page at the same path', () => {
    expect(parseYoutubeInput('https://www.youtube.com/c/SomeName')).toEqual({ kind: 'page', path: '/c/SomeName' });
  });

  test('a /user/ link resolves to a page at the same path', () => {
    expect(parseYoutubeInput('https://www.youtube.com/user/SomeName')).toEqual({ kind: 'page', path: '/user/SomeName' });
  });

  test('a /watch link with v and list resolves to the playlist, not the video', () => {
    expect(parseYoutubeInput('https://www.youtube.com/watch?v=abc123&list=PL1')).toEqual({ kind: 'playlist', playlistId: 'PL1' });
  });

  test('a /watch link with only v resolves to a video', () => {
    expect(parseYoutubeInput('https://www.youtube.com/watch?v=abc123')).toEqual({ kind: 'video', videoId: 'abc123' });
  });

  test('a bare word resolves to a page only when the caller passes the youtube hint', () => {
    expect(parseYoutubeInput('Underscore_', true)).toEqual({ kind: 'page', path: '/@Underscore_' });
    expect(parseYoutubeInput('Underscore_', false)).toBeNull();
    expect(parseYoutubeInput('Underscore_')).toBeNull();
  });

  test('accepts the m. and music. hosts too', () => {
    expect(parseYoutubeInput(`https://m.youtube.com/channel/${CHANNEL_ID}`)).toEqual({ kind: 'channel', channelId: CHANNEL_ID });
    expect(parseYoutubeInput(`https://music.youtube.com/channel/${CHANNEL_ID}`)).toEqual({ kind: 'channel', channelId: CHANNEL_ID });
  });

  test('accepts a link with the http scheme or with no scheme', () => {
    expect(parseYoutubeInput('http://www.youtube.com/watch?v=abc123')).toEqual({ kind: 'video', videoId: 'abc123' });
    expect(parseYoutubeInput('www.youtube.com/@Underscore_')).toEqual({ kind: 'page', path: '/@Underscore_' });
    expect(parseYoutubeInput('youtu.be/abc123')).toEqual({ kind: 'video', videoId: 'abc123' });
  });

  test('a scheme that appears later in the text does not make it a link with a scheme', () => {
    expect(parseYoutubeInput('youtube.com/watch?v=abc123&next=https://example.com')).toEqual({ kind: 'video', videoId: 'abc123' });
  });

  test('ignores the spaces around the text', () => {
    expect(parseYoutubeInput('  @Underscore_  ')).toEqual({ kind: 'page', path: '/@Underscore_' });
    expect(parseYoutubeInput('  https://youtu.be/abc123 ')).toEqual({ kind: 'video', videoId: 'abc123' });
  });

  test.each([
    `https://www.youtube.com/other/channel/${CHANNEL_ID}`,
    'https://www.youtube.com/other/@Underscore_',
    'https://www.youtube.com/other/user/SomeName',
    'https://www.youtube.com/results?v=abc123',
  ])('%s is not a channel, a playlist or a video', (link) => {
    expect(parseYoutubeInput(link)).toBeNull();
  });
});

describe('isYoutubeLink', () => {
  test('is true for a full youtube url', () => {
    expect(isYoutubeLink('https://www.youtube.com/@Underscore_')).toBe(true);
  });

  test('is false for a youtube host with a page that is not a channel, a playlist or a video', () => {
    expect(isYoutubeLink('https://www.youtube.com/')).toBe(false);
  });

  test('ignores the spaces around the link', () => {
    expect(isYoutubeLink('  https://www.youtube.com/@Underscore_  ')).toBe(true);
  });
});

function channelFeedXml(feedLevelChannelId?: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <title>Underscore_</title>
  <subtitle>Channel feed</subtitle>
  ${feedLevelChannelId ? `<yt:channelId>${feedLevelChannelId}</yt:channelId>` : ''}
  <entry>
    <id>yt:video:abc123</id>
    <yt:videoId>abc123</yt:videoId>
    <yt:channelId>${CHANNEL_ID}</yt:channelId>
    <title>A Video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=abc123"/>
    <published>2024-01-01T00:00:00+00:00</published>
    <media:group>
      <media:description>Full description here.</media:description>
      <media:thumbnail url="https://i.ytimg.com/vi/abc123/hqdefault.jpg"/>
      <media:community>
        <media:starRating average="4.5"/>
        <media:statistics views="1000"/>
      </media:community>
    </media:group>
  </entry>
  <entry>
    <id>yt:video:noMedia</id>
    <title>No Media Entry</title>
    <published>2024-01-02T00:00:00+00:00</published>
  </entry>
</feed>`;
}

describe('parseFeedContent', () => {

  test('maps description, thumbnail, guid and extra from an entry', () => {
    const result = parseFeedContent(channelFeedXml());

    expect(result?.title).toBe('Underscore_');
    expect(result?.description).toBe('Channel feed');
    expect(result?.items[0]).toEqual({
      title: 'A Video',
      guid: 'yt:video:abc123',
      link: 'https://www.youtube.com/watch?v=abc123',
      pubDate: '2024-01-01T00:00:00+00:00',
      description: 'Full description here.',
      image: 'https://i.ytimg.com/vi/abc123/hqdefault.jpg',
      author: undefined,
      extra: JSON.stringify({ videoId: 'abc123', channelId: CHANNEL_ID, views: 1000, rating: 4.5 }),
      read_at: undefined,
    });
  });

  test('gives an entry with no media:group an empty description and extra', () => {
    const result = parseFeedContent(channelFeedXml());

    expect(result?.items[1]).toEqual({
      title: 'No Media Entry',
      guid: 'yt:video:noMedia',
      link: undefined,
      pubDate: '2024-01-02T00:00:00+00:00',
      description: '',
      image: undefined,
      author: undefined,
      extra: '{}',
      read_at: undefined,
    });
  });

  const atom = (inner: string) => `<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom" xmlns:media="http://search.yahoo.com/mrss/">${inner}</feed>`;

  test('a feed with no title, subtitle or entry has empty text and no item', () => {
    // Act
    const result = parseFeedContent(atom('<id>feed</id>'));

    // Assert
    expect(result).toEqual({ title: '', description: '', items: [] });
  });

  test('an entry with no title, date, id or link gets placeholders and a hashed guid', () => {
    // Act
    const item = parseFeedContent(atom('<id>feed</id><entry><author><name>Someone</name></author></entry>'))?.items[0];

    // Assert
    expect(item?.title).toBe('No title');
    expect(item?.pubDate).toBe('No publication date');
    expect(item?.guid).toMatch(/^monfil:hash:[0-9a-f]{40}$/);
  });

  test.each([
    ['the alternate link, whatever its place', '<link rel="enclosure" href="https://e.example/"/><link rel="alternate" href="https://a.example/"/>', 'https://a.example/'],
  ])('the link of an entry is %s', (_name, links, expected) => {
    // Act
    const item = parseFeedContent(atom(`<entry><id>x</id><title>T</title><published>2024-01-01T00:00:00Z</published>${links}</entry>`))?.items[0];

    // Assert
    expect(item?.link).toBe(expected);
  });
});

describe('fetchFeed', () => {
  afterEach(() => {
    mockedFetchConditional.mockReset();
    mockedFetchText.mockReset();
  });

  function channelPageHtml(channelId: string = CHANNEL_ID): string {
    return `<!doctype html><html><head>
<link rel="canonical" href="https://www.youtube.com/channel/${channelId}">
<meta property="og:image" content="${AVATAR_RAW}">
<meta property="og:title" content="Underscore_">
<meta property="og:description" content="A channel about things.">
</head></html>`;
  }

  function watchPageHtml(channelId: string = CHANNEL_ID): string {
    return `<!doctype html><html><head>
<link rel="canonical" href="https://www.youtube.com/watch?v=abc123">
<script>var ytInitialData = {"channelId":"${channelId}"};</script>
</head></html>`;
  }

  function playlistFeedXml(): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
  <title>A Playlist</title>
  <subtitle>Playlist feed</subtitle>
  <yt:channelId>${CHANNEL_ID}</yt:channelId>
  <entry>
    <id>yt:video:def456</id>
    <title>Playlist Video</title>
    <link rel="alternate" href="https://www.youtube.com/watch?v=def456"/>
    <published>2024-01-02T00:00:00+00:00</published>
  </entry>
</feed>`;
  }

  function fetched(body: string) {
    return { success: true as const, data: { body, validators: { etag: undefined, last_modified: undefined } } };
  }

  function mockResponses(responses: Record<string, ReturnType<typeof fetched> | { success: false; error: FetchUrlError }>) {
    mockedFetchText.mockImplementation((url: string) =>
      Promise.resolve(responses[url] ?? { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: `unexpected fetch: ${url}` } }),
    );
  }

  test('the channel path fetches the avatar page and the feed', async () => {
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched(channelFeedXml()),
    });

    const result = await fetchFeed({ link: CHANNEL_ID });

    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: expect.objectContaining({
          type: 'youtube',
          link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
          title: 'Underscore_',
          icon: AVATAR_NORMALIZED,
        }),
      },
    });
    expect(mockedFetchText).toHaveBeenCalledTimes(2);
  });

  test('the handle path resolves the channel id and avatar from the one page fetch', async () => {
    mockResponses({
      'https://www.youtube.com/@Underscore_': fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched(channelFeedXml()),
    });

    const result = await fetchFeed({ link: '@Underscore_' });

    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: expect.objectContaining({ icon: AVATAR_NORMALIZED, link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}` }),
      },
    });
    expect(mockedFetchText).toHaveBeenCalledTimes(2);
    expect(mockedFetchText).not.toHaveBeenCalledWith(`https://www.youtube.com/channel/${CHANNEL_ID}`);
  });

  test('the playlist path reads the owner from the feed-level yt:channelId', async () => {
    mockResponses({
      'https://www.youtube.com/feeds/videos.xml?playlist_id=PL1': fetched(playlistFeedXml()),
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: fetched(channelPageHtml()),
    });

    const result = await fetchFeed({ link: 'https://www.youtube.com/playlist?list=PL1' });

    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: expect.objectContaining({
          link: 'https://www.youtube.com/feeds/videos.xml?playlist_id=PL1',
          title: 'A Playlist',
          icon: AVATAR_NORMALIZED,
        }),
      },
    });
    expect(mockedFetchText).toHaveBeenCalledTimes(2);
  });

  test('the video path resolves the channel from the watch page, then continues as a channel', async () => {
    mockResponses({
      'https://www.youtube.com/watch?v=abc123': fetched(watchPageHtml()),
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched(channelFeedXml()),
    });

    const result = await fetchFeed({ link: 'https://www.youtube.com/watch?v=abc123' });

    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: expect.objectContaining({ icon: AVATAR_NORMALIZED, link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}` }),
      },
    });
    expect(mockedFetchText).toHaveBeenCalledTimes(3);
  });


  test('returns UNSUPPORTED_FORMAT for an input with no recognizable shape', async () => {
    const result = await fetchFeed({ link: 'https://example.com/nothing' });

    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a YouTube channel, playlist or video.", params: { reason: 'youtubeNotRecognized' } } });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('a stored bare word is read as a handle', async () => {
    // Arrange
    mockResponses({
      'https://www.youtube.com/@Underscore_': fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched(channelFeedXml()),
    });

    // Act
    const result = await fetchFeed({ link: 'Underscore_' });

    // Assert
    expect(result.success).toBe(true);
    expect(mockedFetchText).toHaveBeenCalledWith('https://www.youtube.com/@Underscore_');
  });

  test('a handle page with no channel id is refused', async () => {
    // Arrange
    mockResponses({ 'https://www.youtube.com/@Nobody': fetched('<html></html>') });

    // Act
    const result = await fetchFeed({ link: '@Nobody' });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find a YouTube channel at that address.", params: { reason: 'youtubeNoChannel' } } });
  });

  test('a video page with no channel id is refused', async () => {
    // Arrange
    mockResponses({ 'https://www.youtube.com/watch?v=abc123': fetched('<html></html>') });

    // Act
    const result = await fetchFeed({ link: 'https://www.youtube.com/watch?v=abc123' });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find the channel for that video.", params: { reason: 'youtubeNoVideoChannel' } } });
  });

  test('a playlist feed with no owner is refused', async () => {
    // Arrange
    const noOwner = playlistFeedXml().replace(/<yt:channelId>.*<\/yt:channelId>/, '');
    mockResponses({ 'https://www.youtube.com/feeds/videos.xml?playlist_id=PL1': fetched(noOwner) });

    // Act
    const result = await fetchFeed({ link: 'https://www.youtube.com/playlist?list=PL1' });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find the channel that owns that playlist.", params: { reason: 'youtubeNoPlaylistChannel' } } });
  });

  test('a feed body that is not atom is refused', async () => {
    // Arrange
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched('<rss version="2.0"><channel><title>x</title></channel></rss>'),
    });

    // Act
    const result = await fetchFeed({ link: CHANNEL_ID });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a YouTube channel feed.", params: { reason: 'youtubeNotChannelFeed' } } });
  });

  test('an error thrown while fetching becomes a parse error, and a value that is not an error an unknown one', async () => {
    // Arrange
    mockedFetchText.mockRejectedValueOnce(new Error('boom'));
    mockedFetchText.mockRejectedValueOnce('boom');

    // Act
    const failed = await fetchFeed({ link: CHANNEL_ID });
    const unknown = await fetchFeed({ link: CHANNEL_ID });

    // Assert
    expect(failed).toEqual({ success: false, error: { name: 'PARSE_ERROR', message: 'boom' } });
    expect(unknown).toEqual({ success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } });
  });

  test('discover returns the one feed that the input leads to', async () => {
    // Arrange
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched(channelFeedXml()),
    });

    // Act
    const result = await youtubeSource.discover(CHANNEL_ID);

    // Assert
    expect(result.success && result.data.map((source) => [source.type, source.link, source.title])).toEqual([
      ['youtube', `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`, 'Underscore_'],
    ]);
  });
});
