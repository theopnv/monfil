// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseFeedContent, rssSource } from './rss';
import { fetchText } from '../../lib/fetch';

vi.mock(import('../../lib/fetch'), () => ({
  fetchText: vi.fn(),
}));

const mockedFetchText = vi.mocked(fetchText);
const fetchFeed = rssSource.fetch;
const SYNTHETIC_GUID = expect.stringMatching(/^monfil:hash:[0-9a-f]{40}$/) as unknown as string;

describe('parseFeedContent', () => {
  const validRssFeed = `
    <rss version="2.0" xmlns:media="http://search.yahoo.com/mrss/">
      <channel>
        <title>Test Feed</title>
        <description>A feed for testing</description>
        <item>
          <title>Item 1</title>
          <link>http://example.com/item1</link>
          <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          <description>Item 1 description</description>
        </item>
        <item>
          <title>Item 2</title>
          <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Item 3</title>
          <pubDate>Wed, 03 Jan 2024 00:00:00 GMT</pubDate>
          <media:thumbnail url="http://example.com/item3-thumb.jpg" />
        </item>
      </channel>
    </rss>
  `;

  test('should return the feed title, description and items when format is rss', () => {
    const result = parseFeedContent(validRssFeed);
    expect(result).toEqual({
      title: 'Test Feed',
      description: 'A feed for testing',
      items: [
        {
          title: 'Item 1',
          guid: 'http://example.com/item1',
          link: 'http://example.com/item1',
          pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT',
          description: 'Item 1 description',
          image: undefined,
          author: undefined,
          extra: undefined,
          read_at: undefined,
        },
        {
          title: 'Item 2',
          guid: SYNTHETIC_GUID,
          link: undefined,
          pubDate: 'Tue, 02 Jan 2024 00:00:00 GMT',
          description: '',
          image: undefined,
          author: undefined,
          extra: undefined,
          read_at: undefined,
        },
        {
          title: 'Item 3',
          guid: SYNTHETIC_GUID,
          link: undefined,
          pubDate: 'Wed, 03 Jan 2024 00:00:00 GMT',
          description: '',
          image: 'http://example.com/item3-thumb.jpg',
          author: undefined,
          extra: undefined,
          read_at: undefined,
        }
      ]
    });
  });

  const validAtomFeed = `
    <feed xmlns="http://www.w3.org/2005/Atom">
      <title>Test Feed</title>
      <subtitle>A feed for testing</subtitle>
      <entry>
        <title>Item 1</title>
        <link href="http://example.com/item1" rel="alternate" />
        <published>2024-01-01T00:00:00Z</published>
        <summary>Item 1 description</summary>
      </entry>
      <entry>
        <title>Item 2</title>
        <updated>2024-01-02T00:00:00Z</updated>
      </entry>
      <entry>
        <title>Item 3</title>
        <updated>2024-01-03T00:00:00Z</updated>
        <content type="html">&lt;p&gt;intro&lt;/p&gt;&lt;img src="http://example.com/item3-thumb.jpg"&gt;</content>
      </entry>
    </feed>
  `;

  test('should return the feed title, description and items when format is atom', () => {
    const result = parseFeedContent(validAtomFeed);
    expect(result).toEqual({
      title: 'Test Feed',
      description: 'A feed for testing',
      items: [
        {
          title: 'Item 1',
          guid: 'http://example.com/item1',
          link: 'http://example.com/item1',
          pubDate: '2024-01-01T00:00:00Z',
          description: 'Item 1 description',
          image: undefined,
          author: undefined,
          extra: undefined,
          read_at: undefined,
        },
        {
          title: 'Item 2',
          guid: SYNTHETIC_GUID,
          link: undefined,
          pubDate: '2024-01-02T00:00:00Z',
          description: '',
          image: undefined,
          author: undefined,
          extra: undefined,
          read_at: undefined,
        },
        {
          title: 'Item 3',
          guid: SYNTHETIC_GUID,
          link: undefined,
          pubDate: '2024-01-03T00:00:00Z',
          description: '<p>intro</p><img src="http://example.com/item3-thumb.jpg">',
          image: 'http://example.com/item3-thumb.jpg',
          author: undefined,
          extra: undefined,
          read_at: undefined,
        }
      ]
    });
  });

  const validJsonFeed = JSON.stringify({
    version: 'https://jsonfeed.org/version/1.1',
    title: 'Test Feed',
    home_page_url: 'https://example.com',
    description: 'A feed for testing',
    items: [
      {
        id: 'https://example.com/items/1',
        url: 'https://example.com/items/1',
        title: 'Item 1',
        content_html: '<p>Item 1 content</p><img src="https://example.com/item1.jpg">',
        summary: 'Item 1 summary',
        date_published: '2024-01-01T00:00:00Z',
        authors: [{ name: 'Ada Lovelace' }],
      },
      {
        id: '2',
        url: 'https://example.com/items/2',
        title: 'Item 2',
        content_text: 'Item 2 plain text',
        date_published: '2024-01-02T00:00:00Z',
        image: 'https://example.com/item2.jpg',
      },
    ],
  });

  test('should return the feed title, description and items when format is json', () => {
    const result = parseFeedContent(validJsonFeed);
    expect(result).toEqual({
      title: 'Test Feed',
      description: 'A feed for testing',
      siteLink: 'https://example.com',
      items: [
        {
          title: 'Item 1',
          guid: 'https://example.com/items/1',
          link: 'https://example.com/items/1',
          pubDate: '2024-01-01T00:00:00Z',
          description: '<p>Item 1 content</p><img src="https://example.com/item1.jpg">',
          image: 'https://example.com/item1.jpg',
          author: 'Ada Lovelace',
          extra: undefined,
          read_at: undefined,
        },
        {
          title: 'Item 2',
          guid: '2',
          link: 'https://example.com/items/2',
          pubDate: '2024-01-02T00:00:00Z',
          description: 'Item 2 plain text',
          image: 'https://example.com/item2.jpg',
          author: undefined,
          extra: undefined,
          read_at: undefined,
        }
      ]
    });
  });

});

describe('item identity', () => {
  function guidsOf(content: string): (string | undefined)[] {
    return parseFeedContent(content)?.items.map((item) => item.guid) ?? [];
  }

  test('gives two items with neither a guid nor a link distinct identities', () => {
    // Arrange
    const content = `
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <item><title>Item 1</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
          <item><title>Item 2</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
        </channel>
      </rss>
    `;

    // Act
    const guids = guidsOf(content);

    // Assert
    expect(guids).toEqual([SYNTHETIC_GUID, SYNTHETIC_GUID]);
    expect(guids[0]).not.toBe(guids[1]);
  });
});

describe('fetchFeed', () => {

  afterEach(() => {
    mockedFetchText.mockReset();
  });


  test.each([
    { name: 'a doctype page', body: '<!DOCTYPE html><html><head><title>Verifying</title></head><body>Captcha</body></html>' },
    { name: 'a bare html page behind whitespace', body: '\n  <html><script>location.reload()</script></html>' },
  ])('names the bot check when the server sends $name instead of the feed', async ({ body }) => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: true, data: { body, validators: { etag: undefined, last_modified: undefined } } });

    // Act
    const result = await fetchFeed({ link: 'https://example.com/feed' });

    // Assert
    expect(result).toEqual({
      success: false,
      error: { name: 'PARSE_ERROR', message: 'The site sent a web page instead of the feed. It may show a bot check to automated readers or to your network or VPN.', params: { reason: 'htmlPage' } },
    });
  });
});

describe('rssSource.discover', () => {
  const FEED = (title: string) => `<rss version="2.0"><channel><title>${title}</title><item><title>Item</title><link>https://blog.test/1</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`;
  const ok = (body: string) => ({ success: true as const, data: { body, validators: { etag: undefined, last_modified: undefined } } });
  const notFound = { success: false as const, error: { name: 'GENERIC_FETCH_ERROR' as const, message: '404' } };

  afterEach(() => {
    mockedFetchText.mockReset();
  });

  test('ignores the spaces around the link', async () => {
    // Arrange
    mockedFetchText.mockImplementation((url) => Promise.resolve(url === 'https://blog.test/posts/rss' ? ok(FEED('Direct')) : notFound));

    // Act
    const result = await rssSource.discover('  https://blog.test/posts/rss  ');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ link: 'https://blog.test/posts/rss' })] });
  });

  test('refuses text that is not a link without a request', async () => {
    // Act
    const result = await rssSource.discover('not a link');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a link.", params: { reason: 'notLink' } } });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('probes the common paths when the feed that the page advertises does not load', async () => {
    // Arrange
    const page = '<html><head><link rel="alternate" type="application/rss+xml" href="/broken.xml"></head></html>';
    mockedFetchText.mockImplementation((url) => Promise.resolve(
      url === 'https://blog.test/' ? ok(page)
        : url === 'https://blog.test/feed.xml' ? ok(FEED('Probed'))
          : notFound,
    ));

    // Act
    const result = await rssSource.discover('https://blog.test/');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ link: 'https://blog.test/feed.xml', title: 'Probed' })] });
  });

  test('offers every feed a page links to, in page order', async () => {
    // Arrange
    const page = '<html><head><link rel="alternate" type="application/rss+xml" title="Posts" href="/posts.xml"><link rel="alternate" type="application/atom+xml" href="/comments.atom"></head></html>';
    mockedFetchText.mockImplementation((url) => Promise.resolve(url === 'https://blog.test/' ? ok(page) : ok(FEED(url))));

    // Act
    const result = await rssSource.discover('https://blog.test/');

    // Assert
    expect(result.success ? result.data.map((candidate) => candidate.link) : []).toEqual(['https://blog.test/posts.xml', 'https://blog.test/comments.atom']);
  });

  test('probes common paths when the page has no feed link and stops at the first feed', async () => {
    // Arrange
    mockedFetchText.mockImplementation((url) => Promise.resolve(
      url === 'https://blog.test/' ? ok('<html></html>')
        : url === 'https://blog.test/atom.xml' ? ok(FEED('Probed'))
          : notFound,
    ));

    // Act
    const result = await rssSource.discover('https://blog.test/');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ link: 'https://blog.test/atom.xml', title: 'Probed' })] });
    expect(mockedFetchText.mock.calls.map(([url]) => url)).not.toContain('https://blog.test/index.xml');
  });

  test('reports a missing feed when nothing on the page or the probes parses', async () => {
    // Arrange
    mockedFetchText.mockImplementation((url) => Promise.resolve(url === 'https://blog.test/' ? ok('<html></html>') : notFound));

    // Act
    const result = await rssSource.discover('https://blog.test/');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find a feed at that address.", params: { reason: 'noFeedAtAddress' } } });
  });

  test('a Mastodon-shaped profile URL becomes a mastodon feed when its .rss parses', async () => {
    // Arrange
    mockedFetchText.mockImplementation((url) => Promise.resolve(url === 'https://hachyderm.io/@nova.rss' ? ok(FEED('nova')) : notFound));

    // Act
    const result = await rssSource.discover('https://hachyderm.io/@nova');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ type: 'mastodon', link: 'https://hachyderm.io/@nova.rss' })] });
  });

  test('a Mastodon-shaped URL falls back to page discovery when its .rss does not parse', async () => {
    // Arrange
    const page = '<link rel="alternate" type="application/rss+xml" href="/@writer/feed">';
    mockedFetchText.mockImplementation((url) => Promise.resolve(
      url === 'https://medium.test/@writer' ? ok(page)
        : url === 'https://medium.test/@writer/feed' ? ok(FEED('writer'))
          : notFound,
    ));

    // Act
    const result = await rssSource.discover('https://medium.test/@writer');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ type: 'rss', link: 'https://medium.test/@writer/feed' })] });
  });

  test('takes the icon a direct feed\'s site page declares', async () => {
    // Arrange
    const feed = '<rss version="2.0"><channel><title>Moderne</title><link>https://moderne.test/blog</link></channel></rss>';
    mockedFetchText.mockImplementation((url) => Promise.resolve(
      url === 'https://moderne.test/feed.xml' ? ok(feed)
        : url === 'https://moderne.test/blog' ? ok('<link rel="icon" href="/brand/symbol.svg">')
          : notFound,
    ));

    // Act
    const result = await rssSource.discover('https://moderne.test/feed.xml');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ icon: 'https://moderne.test/brand/symbol.svg' })] });
  });

  test('takes the icon an advertised feed\'s site page declares', async () => {
    // Arrange
    const page = '<link rel="alternate" type="application/rss+xml" href="https://feeds.test/blog"><link rel="icon" href="/favicon.svg">';
    const feed = '<feed xmlns="http://www.w3.org/2005/Atom"><title>Blog</title><link rel="alternate" href="https://blog.test/"/></feed>';
    mockedFetchText.mockImplementation((url) => Promise.resolve(
      url === 'https://blog.test/' ? ok(page)
        : url === 'https://feeds.test/blog' ? ok(feed)
          : notFound,
    ));

    // Act
    const result = await rssSource.discover('https://blog.test/');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ link: 'https://feeds.test/blog', icon: 'https://blog.test/favicon.svg' })] });
  });
});

describe('rssSource.discover private hosts', () => {
  const FEED = '<rss version="2.0"><channel><title>Feed</title><item><title>Item</title><link>https://blog.test/1</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>';
  const ok = (body: string) => ({ success: true as const, data: { body, validators: { etag: undefined, last_modified: undefined } } });

  afterEach(() => {
    mockedFetchText.mockReset();
  });

  test('blocks private hosts for a feed link that a page advertises on another host', async () => {
    // Arrange
    const page = '<link rel="alternate" type="application/rss+xml" href="http://127.0.0.1:8080/feed.xml">';
    mockedFetchText.mockImplementation((url) => Promise.resolve(url === 'https://blog.test/' ? ok(page) : ok(FEED)));

    // Act
    await rssSource.discover('https://blog.test/');

    // Assert
    expect(mockedFetchText).toHaveBeenCalledWith('http://127.0.0.1:8080/feed.xml', { blockPrivateHosts: true });
  });

  test('keeps the trust of the typed link for a feed link on the same host', async () => {
    // Arrange
    const page = '<link rel="alternate" type="application/rss+xml" href="/feed.xml">';
    mockedFetchText.mockImplementation((url) => Promise.resolve(url === 'http://127.0.0.1:8080/' ? ok(page) : ok(FEED)));

    // Act
    const result = await rssSource.discover('http://127.0.0.1:8080/');

    // Assert
    expect(result.success).toBe(true);
    expect(mockedFetchText).toHaveBeenCalledWith('http://127.0.0.1:8080/feed.xml');
  });
});
