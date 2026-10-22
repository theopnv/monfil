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

  test('reads every item in a busy feed', () => {
    // Arrange
    const entries = Array.from({ length: 40 }, (_, index) => `<item><guid>item-${index}</guid><title>Item ${index}</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>`).join('');
    const content = `<rss version="2.0"><channel><title>Busy feed</title>${entries}</channel></rss>`;

    // Act
    const result = parseFeedContent(content);

    // Assert
    expect(result?.items).toHaveLength(40);
    expect(result?.items[39]?.guid).toBe('item-39');
  });

  test('decodes literal entities left over from CDATA titles and descriptions', () => {
    // Some feeds (e.g. The Verge) wrap titles in CDATA but still entity-encode punctuation inside
    // it, so the XML parser leaves entities like "&#8217;" and "&#8230;" as literal text.
    const feedWithEncodedEntities = `
      <rss version="2.0">
        <channel>
          <title>Feed &#8217;n stuff</title>
          <description>A &#8230; feed</description>
          <item>
            <title><![CDATA[Apple&#8217;s ‘new’ polishing cloth]]></title>
            <link>http://example.com/item1</link>
            <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
            <description>Matches an archived [&#8230;]</description>
          </item>
        </channel>
      </rss>
    `;

    const result = parseFeedContent(feedWithEncodedEntities);

    expect(result?.title).toBe('Feed ’n stuff');
    expect(result?.description).toBe('A … feed');
    expect(result?.items[0]?.title).toBe('Apple’s ‘new’ polishing cloth');
    expect(result?.items[0]?.description).toBe('Matches an archived […]');
  });

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

  const validRdfFeed = `
    <rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#" xmlns="http://purl.org/rss/1.0/" xmlns:dc="http://purl.org/dc/elements/1.1/">
      <channel rdf:about="http://example.com">
        <title>Test Feed</title>
        <link>http://example.com</link>
        <description>A feed for testing</description>
      </channel>
      <item rdf:about="http://example.com/item1">
        <title>Item 1</title>
        <link>http://example.com/item1</link>
        <description>Item 1 description</description>
        <dc:creator>Ada Lovelace</dc:creator>
        <dc:date>2024-01-01T00:00:00Z</dc:date>
      </item>
      <item rdf:about="http://example.com/item2">
        <title>Item 2</title>
        <link>http://example.com/item2</link>
        <dc:date>2024-01-02T00:00:00Z</dc:date>
      </item>
    </rdf:RDF>
  `;

  test('should return the feed title, description and items when format is rdf', () => {
    const result = parseFeedContent(validRdfFeed);
    expect(result).toEqual({
      title: 'Test Feed',
      description: 'A feed for testing',
      siteLink: 'http://example.com',
      items: [
        {
          title: 'Item 1',
          guid: 'http://example.com/item1',
          link: 'http://example.com/item1',
          pubDate: '2024-01-01T00:00:00Z',
          description: 'Item 1 description',
          image: undefined,
          author: 'Ada Lovelace',
          extra: undefined,
          read_at: undefined,
        },
        {
          title: 'Item 2',
          guid: 'http://example.com/item2',
          link: 'http://example.com/item2',
          pubDate: '2024-01-02T00:00:00Z',
          description: '',
          image: undefined,
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

  test('prefers the rss <guid> over the link', () => {
    // Arrange
    const content = `
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <item>
            <title>Item 1</title>
            <guid isPermaLink="false">tag:example.com,2024:1</guid>
            <link>http://example.com/item1</link>
            <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    // Act
    // Assert
    expect(guidsOf(content)).toEqual(['tag:example.com,2024:1']);
  });

  test('prefers the atom <id> over the link', () => {
    // Arrange
    const content = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Test Feed</title>
        <entry>
          <title>Item 1</title>
          <id>urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a</id>
          <link href="http://example.com/item1" rel="alternate" />
          <updated>2024-01-01T00:00:00Z</updated>
        </entry>
      </feed>
    `;

    // Act
    // Assert
    expect(guidsOf(content)).toEqual(['urn:uuid:1225c695-cfb8-4ebb-aaaa-80da344efa6a']);
  });

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

  test('gives the same item the same identity on a later parse', () => {
    // Arrange
    const content = `
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <item><title>Item 1</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
        </channel>
      </rss>
    `;

    // Act
    // Assert
    expect(guidsOf(content)).toEqual(guidsOf(content));
  });
});

describe('author', () => {
  test('reads the rss dc:creator when there is no <author>', () => {
    // Arrange
    const content = `
      <rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/">
        <channel>
          <title>Test Feed</title>
          <item>
            <title>Item 1</title>
            <dc:creator>Ada Lovelace</dc:creator>
            <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          </item>
        </channel>
      </rss>
    `;

    // Act
    const result = parseFeedContent(content);

    // Assert
    expect(result?.items[0]?.author).toBe('Ada Lovelace');
  });

  test('reads the atom entry author name', () => {
    // Arrange
    const content = `
      <feed xmlns="http://www.w3.org/2005/Atom">
        <title>Test Feed</title>
        <entry>
          <title>Item 1</title>
          <author><name>Ada Lovelace</name></author>
          <updated>2024-01-01T00:00:00Z</updated>
        </entry>
      </feed>
    `;

    // Act
    const result = parseFeedContent(content);

    // Assert
    expect(result?.items[0]?.author).toBe('Ada Lovelace');
  });

  test('leaves author undefined when the feed names nobody', () => {
    // Arrange
    const content = `
      <rss version="2.0">
        <channel>
          <title>Test Feed</title>
          <item><title>Item 1</title><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item>
        </channel>
      </rss>
    `;

    // Act
    const result = parseFeedContent(content);

    // Assert
    expect(result?.items[0]?.author).toBeUndefined();
  });
});

describe('fetchFeed', () => {
  const validRssFeed = `
    <rss version="2.0">
      <channel>
        <title>Test Feed</title>
        <description>A feed for testing</description>
        <item>
          <title>Item 1</title>
          <link>http://example.com/item1</link>
          <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
          <description>Item 1 description</description>
        </item>
      </channel>
    </rss>
  `;

  afterEach(() => {
    mockedFetchText.mockReset();
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
    </feed>
  `;

  test('returns the link, title, description and items on success for rss', async () => {
    mockedFetchText.mockResolvedValue({ success: true, data: { body: validRssFeed, validators: { etag: undefined, last_modified: undefined } } });

    const result = await fetchFeed({ link: 'https://example.com/feed' });

    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: {
          type: 'rss',
          link: 'https://example.com/feed',
          title: 'Test Feed',
          description: 'A feed for testing',
          items: [
            {
              title: 'Item 1',
              guid: 'http://example.com/item1',
              link: 'http://example.com/item1',
              pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT',
              description: 'Item 1 description'
            }
          ]
        }
      }
    });
  });

  test('returns the link, title, description and items on success for atom', async () => {
    mockedFetchText.mockResolvedValue({ success: true, data: { body: validAtomFeed, validators: { etag: undefined, last_modified: undefined } } });

    const result = await fetchFeed({ link: 'https://example.com/feed' });

    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: {
          type: 'rss',
          link: 'https://example.com/feed',
          title: 'Test Feed',
          description: 'A feed for testing',
          items: [
            {
              title: 'Item 1',
              guid: 'http://example.com/item1',
              link: 'http://example.com/item1',
              pubDate: '2024-01-01T00:00:00Z',
              description: 'Item 1 description'
            }
          ]
        }
      }
    });
  });

  test('returns PARSE_ERROR when the content is not a recognized feed', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({
      success: true,
      data: {
        body: '<html><body>Not a feed</body></html>',
        validators: { etag: undefined, last_modified: undefined },
      },
    });

    // Act
    const result = await fetchFeed({ link: 'https://example.com/feed' });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'PARSE_ERROR', message: 'Unrecognized feed format' } });
  });

  test('returns the link, title, description and items on success for json feed', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({
      success: true,
      data: {
        body: JSON.stringify({
          version: 'https://jsonfeed.org/version/1.1',
          title: 'Test Feed',
          description: 'A feed for testing',
          items: [{ id: '1', url: 'https://example.com/items/1', title: 'Item 1', content_text: 'Item 1 text', date_published: '2024-01-01T00:00:00Z' }],
        }),
        validators: { etag: undefined, last_modified: undefined },
      },
    });

    // Act
    const result = await fetchFeed({ link: 'https://example.com/feed' });

    // Assert
    expect(result).toEqual({
      success: true,
      data: {
        validators: { etag: undefined, last_modified: undefined },
        parsed: {
          type: 'rss',
          link: 'https://example.com/feed',
          title: 'Test Feed',
          description: 'A feed for testing',
          items: [
            {
              title: 'Item 1',
              guid: '1',
              link: 'https://example.com/items/1',
              pubDate: '2024-01-01T00:00:00Z',
              description: 'Item 1 text',
            },
          ],
        },
      },
    });
  });

  test('passes through a fetchText failure', async () => {
    mockedFetchText.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'boom' } });

    const result = await fetchFeed({ link: 'https://example.com/feed' });

    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'boom' } });
  });

  test('normalizes a bare domain to an https url', async () => {
    mockedFetchText.mockResolvedValue({ success: true, data: { body: validRssFeed, validators: { etag: undefined, last_modified: undefined } } });

    const result = await fetchFeed({ link: 'example.com/feed' });

    expect(mockedFetchText).toHaveBeenCalledWith('https://example.com/feed');
    expect(result).toEqual({ success: true, data: expect.objectContaining({ parsed: expect.objectContaining({ link: 'https://example.com/feed' }) }) });
  });
});

describe('rssSource.discover', () => {
  const FEED = (title: string) => `<rss version="2.0"><channel><title>${title}</title><item><title>Item</title><link>https://blog.test/1</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`;
  const ok = (body: string) => ({ success: true as const, data: { body, validators: { etag: undefined, last_modified: undefined } } });
  const notFound = { success: false as const, error: { name: 'GENERIC_FETCH_ERROR' as const, message: '404' } };

  afterEach(() => {
    mockedFetchText.mockReset();
  });

  test('returns the feed itself when the link is already a feed', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue(ok(FEED('Direct')));

    // Act
    const result = await rssSource.discover('blog.test/feed');

    // Assert
    expect(result).toEqual({ success: true, data: [expect.objectContaining({ type: 'rss', link: 'https://blog.test/feed', title: 'Direct' })] });
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
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "Couldn't find a feed at that address." } });
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
