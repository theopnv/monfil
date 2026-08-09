import { describe, expect, test } from 'vitest';
import { getFeed } from './run';

describe('getFeed', () => {
  test('should be empty when format is not rss', () => {
    const content = '<feed><title>Test Feed</title></feed>';
    const result = getFeed(content);
    expect(result).toEqual([]);
  })

  const validRssFeed = `
    <rss version="2.0">
      <channel>
        <title>Test Feed</title>
        <item>
          <title>Item 1</title>
          <link>http://example.com/item1</link>
          <pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate>
        </item>
        <item>
          <title>Item 2</title>
          <pubDate>Tue, 02 Jan 2024 00:00:00 GMT</pubDate>
        </item>
      </channel>
    </rss>
  `;

  test('should return feed items when format is rss', () => {
    const result = getFeed(validRssFeed);
    expect(result).toEqual([
      {
        title: 'Item 1',
        link: 'http://example.com/item1',
        pubDate: 'Mon, 01 Jan 2024 00:00:00 GMT'
      },
      {
        title: 'Item 2',
        link: undefined,
        pubDate: 'Tue, 02 Jan 2024 00:00:00 GMT'
      }
    ]);
  });
});
