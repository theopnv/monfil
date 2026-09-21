import { afterEach, describe, expect, test, vi } from 'vitest';
import { extractChannel, isYoutubeLink, parseFeedContent, parseYoutubeInput, youtubeSource } from './youtube';
import { fetchUrl } from '../../lib/fetch';
import type { FetchUrlError } from '../../../shared/contracts';

vi.mock(import('../../lib/fetch'), () => ({
  fetchUrl: vi.fn(),
}));

const mockedFetchUrl = vi.mocked(fetchUrl);
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
  test('maps description, thumbnail, guid and extra from an entry', () => {
    const result = parseFeedContent(channelFeedXml(), 30);

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
    const result = parseFeedContent(channelFeedXml(), 30);

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

  test('returns null for a non-atom format', () => {
    const rss = '<rss version="2.0"><channel><title>x</title></channel></rss>';
    expect(parseFeedContent(rss)).toBeNull();
  });
});

describe('fetchFeed', () => {
  afterEach(() => {
    mockedFetchUrl.mockReset();
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

  function mockResponses(responses: Record<string, { success: true; data: string } | { success: false; error: FetchUrlError }>) {
    mockedFetchUrl.mockImplementation((url: string) =>
      Promise.resolve(responses[url] ?? { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: `unexpected fetch: ${url}` } }),
    );
  }

  test('the channel path fetches the avatar page and the feed', async () => {
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: { success: true, data: channelPageHtml() },
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: { success: true, data: channelFeedXml() },
    });

    const result = await fetchFeed(CHANNEL_ID);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        type: 'youtube',
        link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`,
        title: 'Underscore_',
        icon: AVATAR_NORMALIZED,
      }),
    });
    expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
  });

  test('the handle path resolves the channel id and avatar from the one page fetch', async () => {
    mockResponses({
      'https://www.youtube.com/@Underscore_': { success: true, data: channelPageHtml() },
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: { success: true, data: channelFeedXml() },
    });

    const result = await fetchFeed('@Underscore_');

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ icon: AVATAR_NORMALIZED, link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}` }),
    });
    expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
    expect(mockedFetchUrl).not.toHaveBeenCalledWith(`https://www.youtube.com/channel/${CHANNEL_ID}`);
  });

  test('the playlist path reads the owner from the feed-level yt:channelId', async () => {
    mockResponses({
      'https://www.youtube.com/feeds/videos.xml?playlist_id=PL1': { success: true, data: playlistFeedXml() },
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: { success: true, data: channelPageHtml() },
    });

    const result = await fetchFeed('https://www.youtube.com/playlist?list=PL1');

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({
        link: 'https://www.youtube.com/feeds/videos.xml?playlist_id=PL1',
        title: 'A Playlist',
        icon: AVATAR_NORMALIZED,
      }),
    });
    expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
  });

  test('the video path resolves the channel from the watch page, then continues as a channel', async () => {
    mockResponses({
      'https://www.youtube.com/watch?v=abc123': { success: true, data: watchPageHtml() },
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: { success: true, data: channelPageHtml() },
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: { success: true, data: channelFeedXml() },
    });

    const result = await fetchFeed('https://www.youtube.com/watch?v=abc123');

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ icon: AVATAR_NORMALIZED, link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}` }),
    });
    expect(mockedFetchUrl).toHaveBeenCalledTimes(3);
  });

  test('a failing avatar fetch still returns the feed, with icon undefined', async () => {
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: { success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } },
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: { success: true, data: channelFeedXml() },
    });

    const result = await fetchFeed(CHANNEL_ID);

    expect(result).toEqual({ success: true, data: expect.objectContaining({ icon: undefined }) });
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
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: { success: true, data: channelPageHtml() },
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: { success: false, error },
    });

    const result = await fetchFeed(CHANNEL_ID);

    expect(result).toEqual({ success: false, error });
  });

  test('returns UNSUPPORTED_FORMAT for an input with no recognizable shape', async () => {
    const result = await fetchFeed('https://example.com/nothing');

    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: expect.any(String) } });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('regression: a channel feed with a truncated feed-level yt:channelId still resolves the full id', async () => {
    // The feed body below carries the real, buggy truncated value (no "UC" prefix). The adapter
    // must never read it: for a channel target the id is already known before the feed is fetched.
    mockResponses({
      [`https://www.youtube.com/channel/${CHANNEL_ID}`]: { success: true, data: channelPageHtml() },
      [`https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`]: { success: true, data: channelFeedXml('WedHS9qKebauVIK2J7383g') },
    });

    const result = await fetchFeed(CHANNEL_ID);

    expect(result).toEqual({
      success: true,
      data: expect.objectContaining({ link: `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}` }),
    });
  });
});
