import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseFeedContent, rssSource } from './rss';
import { fetchUrl } from '../../lib/fetch';

vi.mock(import('../../lib/fetch'), () => ({
  fetchUrl: vi.fn(),
}));

const mockedFetchUrl = vi.mocked(fetchUrl);
const fetchFeed = rssSource.fetch;
const SYNTHETIC_GUID = expect.stringMatching(/^monfil:hash:[0-9a-f]{40}$/) as unknown as string;

describe('parseFeedContent', () => {
  test('should be null for an unsupported format like json feed', () => {
    const content = JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: 'JSON Feed', items: [] });
    const result = parseFeedContent(content);
    expect(result).toBeNull();
  })

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

    const result = parseFeedContent(feedWithEncodedEntities, 30);

    expect(result?.title).toBe('Feed ’n stuff');
    expect(result?.description).toBe('A … feed');
    expect(result?.items[0]?.title).toBe('Apple’s ‘new’ polishing cloth');
    expect(result?.items[0]?.description).toBe('Matches an archived […]');
  });

  test('should return the feed title, description and items when format is rss', () => {
    // A maxItems of 0 (the default) means "return zero items" per feedsmith's semantics, so pass an explicit limit here.
    const result = parseFeedContent(validRssFeed, 30);
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
    const result = parseFeedContent(validAtomFeed, 30);
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
});

describe('item identity', () => {
  function guidsOf(content: string): (string | undefined)[] {
    return parseFeedContent(content, 30)?.items.map((item) => item.guid) ?? [];
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
    const result = parseFeedContent(content, 30);

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
    const result = parseFeedContent(content, 30);

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
    const result = parseFeedContent(content, 30);

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
    mockedFetchUrl.mockReset();
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
    mockedFetchUrl.mockResolvedValue({ success: true, data: validRssFeed });

    const result = await fetchFeed('https://example.com/feed');

    expect(result).toEqual({
      success: true,
      data: {
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
    });
  });

  test('returns the link, title, description and items on success for atom', async () => {
    mockedFetchUrl.mockResolvedValue({ success: true, data: validAtomFeed });

    const result = await fetchFeed('https://example.com/feed');

    expect(result).toEqual({
      success: true,
      data: {
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
    });
  });

  test('returns UNSUPPORTED_FORMAT when the content is not a recognized rss or atom feed', async () => {
    mockedFetchUrl.mockResolvedValue({ success: true, data: JSON.stringify({ version: 'https://jsonfeed.org/version/1.1', title: 'JSON Feed', items: [] }) });

    const result = await fetchFeed('https://example.com/feed');

    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: expect.any(String) } });
  });

  test('passes through a fetchUrl failure', async () => {
    mockedFetchUrl.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'boom' } });

    const result = await fetchFeed('https://example.com/feed');

    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'boom' } });
  });

  test('normalizes a bare domain to an https url', async () => {
    mockedFetchUrl.mockResolvedValue({ success: true, data: validRssFeed });

    const result = await fetchFeed('example.com/feed');

    expect(mockedFetchUrl).toHaveBeenCalledWith('https://example.com/feed');
    expect(result).toEqual({ success: true, data: expect.objectContaining({ link: 'https://example.com/feed' }) });
  });
});
