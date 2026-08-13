import { db, dbReady } from '../database';
import { fetchFeed } from '../feed/parse';
import { queryFeedItems } from './query';
import type { FeedItem } from '../types';
import type { Feed } from '../../preload/channels';
import type { Result } from '../../utils';

export const listOfFeeds = [
  {
    link: 'https://aws.amazon.com/blogs/architecture/feed/',
    title: 'AWS Architecture Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://netflixtechblog.com/feed',
    title: 'Netflix Tech Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://research.google/blog/rss/',
    title: 'Google Research Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://engineering.fb.com/feed/',
    title: 'Facebook Engineering Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://medium.com/feed/airbnb-engineering',
    title: 'Airbnb Engineering Blog',
    category: {
      name: 'tech'
    },
  },
  {
    link: 'https://siddhantkhare.com/rss.xml',
    title: 'Siddhant Khare Blog',
    category: {
      name: 'blog'
    },
  },
  {
    link: 'https://writing.antonleicht.me/feed',
    title: 'Threading the Needle | Anton Leicht Blog',
    category: {
      name: 'blog'
    },
  },
];

export function addFeedsToDatabase(feedMetadata: typeof listOfFeeds) {
  return Promise.all(feedMetadata.map(async (feedMetadata) => {
    const categoryResult = await db
      .insertInto('feedCategory')
      .values({ name: feedMetadata.category.name })
      .onConflict((oc) => oc.column('name').doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
      .returning(['id'])
      .executeTakeFirstOrThrow();
    if (categoryResult) {
      const feedMetadataResult = await db
        .insertInto('feedMetadata')
        .values({ link: feedMetadata.link, title: feedMetadata.title, category_id: categoryResult.id })
        .onConflict((oc) => oc.column('link').doUpdateSet((eb) => ({ title: eb.ref('excluded.title') })))
        .returning(['id'])
        .executeTakeFirstOrThrow();

      if (feedMetadataResult) {
        const parsedFeed = await fetchFeed(feedMetadata.link);
        if (parsedFeed.success) {
          const feedItems = parsedFeed.data.items;
          if (feedItems.length > 0) {
            await db
              .insertInto('feedItem')
              .values(feedItems.map(item => ({
                feed_id: feedMetadataResult.id,
                title: item.title,
                link: item.link,
                pubDate: item.pubDate,
                description: item.description
              })))
              .onConflict((oc) => oc.column('link').doNothing())
              .execute();
          }
        } else if (!parsedFeed.success) {
          console.error(`Error fetching feed items for ${feedMetadata.link}: ${parsedFeed.error.name} - ${parsedFeed.error.message}`);
        }
      }
    }
  }));
}

export interface NewFeedInput {
  link: string;
  title: string;
  items: Omit<FeedItem, 'id' | 'feed_id'>[];
  categoryName: string;
  showInHome: boolean;
}

export type AddFeedError = { name: 'DB_ERROR'; message: string };

export async function addFeedToDatabase(input: NewFeedInput): Promise<Result<Feed, AddFeedError>> {
  await dbReady;
  try {
    const category = await db.insertInto('feedCategory')
      .values({ name: input.categoryName })
      .onConflict((oc) => oc.column('name').doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
      .returningAll()
      .executeTakeFirstOrThrow();

    const metadata = await db.insertInto('feedMetadata')
      .values({ link: input.link, title: input.title, category_id: category.id, showInHome: input.showInHome ? 1 : 0 })
      .onConflict((oc) => oc.column('link').doUpdateSet((eb) => ({
        title: eb.ref('excluded.title'),
        category_id: eb.ref('excluded.category_id'),
        showInHome: eb.ref('excluded.showInHome'),
      })))
      .returningAll()
      .executeTakeFirstOrThrow();

    if (input.items.length > 0) {
      await db.insertInto('feedItem')
        .values(input.items.map((item) => ({ feed_id: metadata.id, ...item })))
        .onConflict((oc) => oc.column('link').doNothing())
        .execute();
    }

    const items = await queryFeedItems({ feed_id: metadata.id });
    return { success: true, data: { ...metadata, items, category } };
  } catch (error) {
    if (error instanceof Error) return { success: false, error: { name: 'DB_ERROR', message: error.message } };
    return { success: false, error: { name: 'DB_ERROR', message: 'An unknown error occurred' } };
  }
}
