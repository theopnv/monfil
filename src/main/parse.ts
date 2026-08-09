import { parseFeed } from 'feedsmith'

export type FeedItem = {
  title: string;
  link: string | undefined;
  pubDate: string;
};

export function getFeed(content: string, maxItems: number = 10): FeedItem[] {
  const { format, feed } = parseFeed(content, { maxItems });

  if (format === 'rss') {
    if (feed.items) {
      return feed.items.map(item => ({
        title: item.title ?? 'No title',
        link: item.link,
        pubDate: item.pubDate ?? 'No publication date'
      }));
    }
  }
  return [];
}
