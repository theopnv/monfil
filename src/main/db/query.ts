import { type SelectQueryBuilder } from 'kysely';
import { type Database, type FeedCategory, type FeedItem, type FeedMetadata } from '../types';
import { db } from '../database';

// Criteria handlers force us to explicitly add any new field of a table to the query layer.
// Adding a new field to a table object and forgeting to add it here will result in a compilation error.
type CriteriaHandlers<TB extends keyof Database, T> = {
  [K in keyof T]: (
    query: SelectQueryBuilder<Database, TB, T>,
    value: NonNullable<T[K]>
  ) => SelectQueryBuilder<Database, TB, T>;
};

function applyCriteria<TB extends keyof Database, T>(
  query: SelectQueryBuilder<Database, TB, T>,
  criteria: Partial<T>,
  handlers: CriteriaHandlers<TB, T>
): SelectQueryBuilder<Database, TB, T> {
  let result = query;
  for (const key of Object.keys(criteria) as (keyof T)[]) {
    const value = criteria[key];
    if (value !== undefined) {
      result = handlers[key](result, value as NonNullable<T[typeof key]>);
    }
  }
  return result;
}

const feedItemHandlers = {
  id: (q, v) => q.where('id', '=', v),
  feed_id: (q, v) => q.where('feed_id', '=', v),
  title: (q, v) => q.where('title', '=', v),
  link: (q, v) => q.where('link', '=', v),
  pubDate: (q, v) => q.where('pubDate', '=', v),
  description: (q, v) => q.where('description', '=', v),
} satisfies CriteriaHandlers<'feedItem', FeedItem>;

export function queryFeedItems(criteria: Partial<FeedItem>): Promise<FeedItem[]> {
  return applyCriteria(db.selectFrom('feedItem').selectAll(), criteria, feedItemHandlers).execute();
}

const feedMetadataHandlers = {
  id: (q, v) => q.where('id', '=', v),
  link: (q, v) => q.where('link', '=', v),
  title: (q, v) => q.where('title', '=', v),
  category_id: (q, v) => q.where('category_id', '=', v),
} satisfies CriteriaHandlers<'feedMetadata', FeedMetadata>;

export function queryFeedMetadata(criteria: Partial<FeedMetadata>): Promise<FeedMetadata[]> {
  return applyCriteria(db.selectFrom('feedMetadata').selectAll(), criteria, feedMetadataHandlers).execute();
}

const feedCategoryHandlers = {
  id: (q, v) => q.where('id', '=', v),
  name: (q, v) => q.where('name', '=', v),
} satisfies CriteriaHandlers<'feedCategory', FeedCategory>;

export function queryFeedCategory(criteria: Partial<FeedCategory>): Promise<FeedCategory[]> {
  return applyCriteria(db.selectFrom('feedCategory').selectAll(), criteria, feedCategoryHandlers).execute();
}
