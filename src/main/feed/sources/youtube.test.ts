// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { extractChannel, isYoutubeLink, parseFeedContent, parseYoutubeInput, youtubeSource } from './youtube';
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
  test('a bare channel id resolves to a channel', () => {
    expect(parseYoutubeInput(CHANNEL_ID)).toEqual({ kind: 'channel', channelId: CHANNEL_ID });
  });

  test('a bare handle resolves to a page', () => {
    expect(parseYoutubeInput('@Underscore_')).toEqual({ kind: 'page', path: '/@Underscore_' });
  });

  test('a youtu.be link with a list param resolves to a playlist', () => {
    expect(parseYoutubeInput('https://youtu.be/abc123?list=PL1')).toEqual({ kind: 'playlist', playlistId: 'PL1' });
  });

  test('a bare youtu.be link resolves to a video', () => {
    expect(parseYoutubeInput('https://youtu.be/abc123')).toEqual({ kind: 'video', videoId: 'abc123' });
  });

  test('a videos.xml link with channel_id resolves to a channel', () => {
    expect(parseYoutubeInput(`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`)).toEqual({ kind: 'channel', channelId: CHANNEL_ID });
  });

  test('a videos.xml link with playlist_id resolves to a playlist', () => {
    expect(parseYoutubeInput('https://www.youtube.com/feeds/videos.xml?playlist_id=PL1')).toEqual({ kind: 'playlist', playlistId: 'PL1' });
  });

  test('a /channel/ link resolves to a channel', () => {
    expect(parseYoutubeInput(`https://www.youtube.com/channel/${CHANNEL_ID}`)).toEqual({ kind: 'channel', channelId: CHANNEL_ID });
  });

  test('a handle link with a trailing segment resolves to a page for the handle alone', () => {
    expect(parseYoutubeInput('https://www.youtube.com/@Underscore_/videos')).toEqual({ kind: 'page', path: '/@Underscore_' });
  });

  test('a /c/ link resolves to a page at the same path', () => {
    expect(parseYoutubeInput('https://www.youtube.com/c/SomeName')).toEqual({ kind: 'page', path: '/c/SomeName' });
  });

  test('a /user/ link resolves to a page at the same path', () => {
    expect(parseYoutubeInput('https://www.youtube.com/user/SomeName')).toEqual({ kind: 'page', path: '/user/SomeName' });
  });

  test('a /playlist link with a list param resolves to a playlist', () => {
    expect(parseYoutubeInput('https://www.youtube.com/playlist?list=PL1')).toEqual({ kind: 'playlist', playlistId: 'PL1' });
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

  test('rejects a non-youtube host', () => {
    expect(parseYoutubeInput('https://example.com/channel/UCxxxxxxxxxxxxxxxxxxxxxx')).toBeNull();
  });

  test('rejects an empty string', () => {
    expect(parseYoutubeInput('')).toBeNull();
    expect(parseYoutubeInput('   ')).toBeNull();
  });

  test('rejects a malformed url', () => {
    expect(parseYoutubeInput('http://[::1')).toBeNull();
  });

  test('rejects a watch url with no v param', () => {
    expect(parseYoutubeInput('https://www.youtube.com/watch')).toBeNull();
    expect(parseYoutubeInput('https://www.youtube.com/watch?t=10')).toBeNull();
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
    'https://www.youtube.com/other/c/SomeName',
    'https://www.youtube.com/other/user/SomeName',
    'https://www.youtube.com/results?v=abc123',
    'https://www.youtube.com/channel/UCshort',
    'https://www.youtube.com/',
  ])('%s is not a channel, a playlist or a video', (link) => {
    expect(parseYoutubeInput(link)).toBeNull();
  });

  test('a channel id must have 22 characters after UC', () => {
    expect(parseYoutubeInput(`UC${'a'.repeat(21)}`)).toBeNull();
    expect(parseYoutubeInput(`UC${'a'.repeat(23)}`)).toBeNull();
    expect(parseYoutubeInput(`https://www.youtube.com/channel/UC${'a'.repeat(21)}`)).toBeNull();
  });
});

describe('isYoutubeLink', () => {
  test('is true for a full youtube url', () => {
    expect(isYoutubeLink('https://www.youtube.com/@Underscore_')).toBe(true);
  });

  test('is false for a bare handle with no host', () => {
    expect(isYoutubeLink('@Underscore_')).toBe(false);
  });

  test('is false for a bare channel id with no host', () => {
    expect(isYoutubeLink(CHANNEL_ID)).toBe(false);
  });

  test('is false for a non-youtube host', () => {
    expect(isYoutubeLink('https://example.com/feed')).toBe(false);
  });

  test('is false for a youtube host with a page that is not a channel, a playlist or a video', () => {
    expect(isYoutubeLink('https://www.youtube.com/')).toBe(false);
  });

  test('ignores the spaces around the link', () => {
    expect(isYoutubeLink('  https://www.youtube.com/@Underscore_  ')).toBe(true);
  });
});

describe('extractChannel', () => {
  test('reads the channel id from the canonical link', () => {
    const html = `<link rel="canonical" href="https://www.youtube.com/channel/${CHANNEL_ID}">`;
    expect(extractChannel(html).channelId).toBe(CHANNEL_ID);
  });

  test('falls back to the inline channelId json when there is no canonical link', () => {
    const html = `<script>var ytInitialData = {"channelId":"${CHANNEL_ID}","other":1};</script>`;
    expect(extractChannel(html).channelId).toBe(CHANNEL_ID);
  });

  test('leaves the channel id undefined when neither is present', () => {
    const html = '<html><head><title>Nothing here</title></head></html>';
    expect(extractChannel(html).channelId).toBeUndefined();
  });

  test('rewrites the og:image size suffix to the 2x avatar size', () => {
    const html = `<meta property="og:image" content="${AVATAR_RAW}">`;
    expect(extractChannel(html).icon).toBe(AVATAR_NORMALIZED);
  });

  test('leaves an og:image with an unexpected suffix alone', () => {
    const html = '<meta property="og:image" content="https://example.com/avatar.png">';
    expect(extractChannel(html).icon).toBe('https://example.com/avatar.png');
  });

  test('reads og:title and og:description', () => {
    const html = '<meta property="og:title" content="Underscore_"><meta property="og:description" content="A channel about things.">';
    const result = extractChannel(html);
    expect(result.title).toBe('Underscore_');
    expect(result.description).toBe('A channel about things.');
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
  test('reads every entry in a busy feed', () => {
    // Arrange
    const entries = Array.from({ length: 40 }, (_, index) => `<entry><id>video-${index}</id><title>Video ${index}</title><published>2024-01-01T00:00:00Z</published></entry>`).join('');
    const content = `<feed xmlns="http://www.w3.org/2005/Atom"><title>Busy channel</title>${entries}</feed>`;

    // Act
    const result = parseFeedContent(content);

    // Assert
    expect(result?.items).toHaveLength(40);
    expect(result?.items[39]?.guid).toBe('video-39');
  });

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

  test('an entry with media outside a group has no description or thumbnail', () => {
    // Act
    const item = parseFeedContent(atom('<entry><id>x</id><title>T</title><published>2024-01-01T00:00:00Z</published><media:title>direct</media:title></entry>'))?.items[0];

    // Assert
    expect(item).toMatchObject({ description: '', image: undefined });
  });

  test.each([
    ['the alternate link, whatever its place', '<link rel="enclosure" href="https://e.example/"/><link rel="alternate" href="https://a.example/"/>', 'https://a.example/'],
    ['a link with no rel', '<link rel="enclosure" href="https://e.example/"/><link href="https://plain.example/"/>', 'https://plain.example/'],
    ['the first link when none is an alternate', '<link rel="self" href="https://s.example/"/><link rel="enclosure" href="https://e.example/"/>', 'https://s.example/'],
  ])('the link of an entry is %s', (_name, links, expected) => {
    // Act
    const item = parseFeedContent(atom(`<entry><id>x</id><title>T</title><published>2024-01-01T00:00:00Z</published>${links}</entry>`))?.items[0];

    // Assert
    expect(item?.link).toBe(expected);
  });

  test('returns null for a non-atom format', () => {
    const rss = '<rss version="2.0"><channel><title>x</title></channel></rss>';
    expect(parseFeedContent(rss)).toBeNull();
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

  test('the playlist path returns 304 without downloading the feed body', async () => {
    // Arrange
    mockedFetchConditional.mockResolvedValue({ success: true, data: { notModified: true } });

    // Act
    const result = await fetchFeed({
      link: 'https://www.youtube.com/playlist?list=PL1',
      validators: { etag: '"v1"', last_modified: undefined },
    });

    // Assert
    expect(result).toEqual({ success: true, data: { notModified: true } });
    expect(mockedFetchConditional).toHaveBeenCalledWith(
      'https://www.youtube.com/feeds/videos.xml?playlist_id=PL1',
      { validators: { etag: '"v1"', last_modified: undefined } },
    );
    expect(mockedFetchText).not.toHaveBeenCalled();
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

  test('a failing avatar fetch still returns the feed, with icon undefined', async () => {
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: { success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } },
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched(channelFeedXml()),
    });

    const result = await fetchFeed({ link: CHANNEL_ID });

    expect(result).toEqual({ success: true, data: { validators: { etag: undefined, last_modified: undefined }, parsed: expect.objectContaining({ icon: undefined }) } });
  });

  const fetchUrlErrors: FetchUrlError[] = [
    { name: 'GENERIC_FETCH_ERROR', message: 'boom' },
    { name: 'NETWORK_ERROR', message: 'offline' },
    { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'blocked' },
    { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'too big' },
    { name: 'BLOCKED_URL_ERROR', message: 'private' },
  ];

  test.each(fetchUrlErrors)('passes a $name feed fetch failure straight through', async (error) => {
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: { success: false, error },
    });

    const result = await fetchFeed({ link: CHANNEL_ID });

    expect(result).toEqual({ success: false, error });
  });

  test('returns UNSUPPORTED_FORMAT for an input with no recognizable shape', async () => {
    const result = await fetchFeed({ link: 'https://example.com/nothing' });

    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a YouTube channel, playlist or video." } });
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
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find a YouTube channel at that address." } });
  });

  test('a video page with no channel id is refused', async () => {
    // Arrange
    mockResponses({ 'https://www.youtube.com/watch?v=abc123': fetched('<html></html>') });

    // Act
    const result = await fetchFeed({ link: 'https://www.youtube.com/watch?v=abc123' });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find the channel for that video." } });
  });

  test('a playlist feed with no owner is refused', async () => {
    // Arrange
    const noOwner = playlistFeedXml().replace(/<yt:channelId>.*<\/yt:channelId>/, '');
    mockResponses({ 'https://www.youtube.com/feeds/videos.xml?playlist_id=PL1': fetched(noOwner) });

    // Act
    const result = await fetchFeed({ link: 'https://www.youtube.com/playlist?list=PL1' });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find the channel that owns that playlist." } });
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
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a YouTube channel feed." } });
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

  test('discover passes on a refusal', async () => {
    // Act
    const result = await youtubeSource.discover('https://example.com/nothing');

    // Assert
    expect(!result.success && result.error.name).toBe('UNSUPPORTED_FORMAT');
  });

  test('regression: a channel feed with a truncated feed-level yt:channelId still resolves the full id', async () => {
    // The feed body below carries the real, buggy truncated value (no "UC" prefix). The adapter
    // must never read it: for a channel target the id is already known before the feed is fetched.
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: fetched(channelPageHtml()),
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: fetched(channelFeedXml('WedHS9qKebauVIK2J7383g')),
    });

    const result = await fetchFeed({ link: CHANNEL_ID });

    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: expect.objectContaining({ link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}` }),
      },
    });
  });
});
