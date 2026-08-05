import { parseFeed } from 'feedsmith'

export function getFeed(content: string, maxItems: number = 10) {
  const { format, feed } = parseFeed(content, { maxItems });

  console.log('Feed format:', format)
  console.log('Feed title:', feed.title)

  if (format === 'rss') {
    console.log('RSS feed link:', feed.link);
    if (feed.items) {
      console.log(feed.items.map(item => ({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate
      })));
    }
  }
}
