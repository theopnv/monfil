import { afterEach, describe, expect, test, vi } from 'vitest';
import { parseFeedContent, fetchFeed } from './parse';
import { fetchUrl } from '../fetch';

vi.mock(import('../fetch'), () => ({
  fetchUrl: vi.fn(),
}));

const mockedFetchUrl = vi.mocked(fetchUrl);

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

  test('should return the feed title, description and items when format is rss', () => {
    // A maxItems of 0 (the default) means "return zero items" per feedsmith's semantics, so pass an explicit limit here.
    const result = parseFeedContent(validRssFeed, 30);
    expect(result).toEqual({
      title: 'Test Feed',
      description: 'A feed for testing',
      items: [
        {
          title: 'Item 1',
          link: 'http://example.com/item1',
          pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT',
          description: 'Item 1 description',
          image: undefined,
        },
        {
          title: 'Item 2',
          link: undefined,
          pubDate: 'Tue, 02 Jan 2024 00:00:00 GMT',
          description: '',
          image: undefined,
        },
        {
          title: 'Item 3',
          link: undefined,
          pubDate: 'Wed, 03 Jan 2024 00:00:00 GMT',
          description: '',
          image: 'http://example.com/item3-thumb.jpg',
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
          link: 'http://example.com/item1',
          pubDate: '2024-01-01T00:00:00Z',
          description: 'Item 1 description',
          image: undefined,
        },
        {
          title: 'Item 2',
          link: undefined,
          pubDate: '2024-01-02T00:00:00Z',
          description: '',
          image: undefined,
        },
        {
          title: 'Item 3',
          link: undefined,
          pubDate: '2024-01-03T00:00:00Z',
          description: '<p>intro</p><img src="http://example.com/item3-thumb.jpg">',
          image: 'http://example.com/item3-thumb.jpg',
        }
      ]
    });
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
        link: 'https://example.com/feed',
        title: 'Test Feed',
        description: 'A feed for testing',
        items: [
          {
            title: 'Item 1',
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
        link: 'https://example.com/feed',
        title: 'Test Feed',
        description: 'A feed for testing',
        items: [
          {
            title: 'Item 1',
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
