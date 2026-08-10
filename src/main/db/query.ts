import { type FeedItem, type FeedMetadata } from '../types';
import { db } from '../database';

export function queryFeedItems(criteria: Partial<FeedItem>): Promise<FeedItem[]> {
  let query = db.selectFrom('feedItem').selectAll();

  if (criteria.feed_id !== undefined) {
    query = query.where('feed_id', '=', criteria.feed_id);
  }
  if (criteria.title !== undefined) {
    query = query.where('title', '=', criteria.title);
  }
  if (criteria.link !== undefined) {
    query = query.where('link', '=', criteria.link);
  }
  if (criteria.pubDate !== undefined) {
    query = query.where('pubDate', '=', criteria.pubDate);
  }

  return query.execute();
}

export function queryFeedMetadata(criteria: Partial<FeedMetadata>): Promise<FeedMetadata[]> {
  let query = db.selectFrom('feedMetadata').selectAll();

  if (criteria.link !== undefined) {
    query = query.where('link', '=', criteria.link);
  }
  if (criteria.title !== undefined) {
    query = query.where('title', '=', criteria.title);
  }
  if (criteria.category_id !== undefined) {
    query = query.where('category_id', '=', criteria.category_id);
  }

  return query.execute();
}

export function queryFeedCategory(criteria: { name?: string }): Promise<{ id: number; name: string }[]> {
  let query = db.selectFrom('feedCategory').selectAll();

  if (criteria.name !== undefined) {
    query = query.where('name', '=', criteria.name);
  }

  return query.execute();
}
