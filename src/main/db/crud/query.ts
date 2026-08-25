import { type SelectQueryBuilder } from 'kysely';
import { type ArticleContent, type Database, type FeedCategory, type FeedItem, type FeedMetadata, type Setting } from '../types';
import { db } from '../database';
import type { Feed } from '../../../preload/channels';

// Criteria handlers force us to explicitly add any new field of a table to the query layer.
// Adding a new field to a table object and forgetting to add it here will result in a compilation error.
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
  image: (q, v) => q.where('image', '=', v),
  read_at: (q, v) => q.where('read_at', '=', v),
} satisfies CriteriaHandlers<'feedItem', FeedItem>;

export function queryFeedItems(criteria: Partial<FeedItem>): Promise<FeedItem[]> {
  return applyCriteria(db.selectFrom('feedItem').selectAll(), criteria, feedItemHandlers).execute();
}

const feedMetadataHandlers = {
  id: (q, v) => q.where('id', '=', v),
  link: (q, v) => q.where('link', '=', v),
  title: (q, v) => q.where('title', '=', v),
  category_id: (q, v) => q.where('category_id', '=', v),
  showInHome: (q, v) => q.where('showInHome', '=', v),
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

const articleContentHandlers = {
  item_id: (q, v) => q.where('item_id', '=', v),
  html: (q, v) => q.where('html', '=', v),
  text: (q, v) => q.where('text', '=', v),
  word_count: (q, v) => q.where('word_count', '=', v),
  status: (q, v) => q.where('status', '=', v),
} satisfies CriteriaHandlers<'articleContent', ArticleContent>;

export function queryArticleContent(criteria: Partial<ArticleContent>): Promise<ArticleContent[]> {
  return applyCriteria(db.selectFrom('articleContent').selectAll(), criteria, articleContentHandlers).execute();
}

const settingHandlers = {
  key: (q, v) => q.where('key', '=', v),
  value: (q, v) => q.where('value', '=', v),
} satisfies CriteriaHandlers<'setting', Setting>;

export function querySettings(criteria: Partial<Setting>): Promise<Setting[]> {
  return applyCriteria(db.selectFrom('setting').selectAll(), criteria, settingHandlers).execute();
}

export async function countFeedItems(): Promise<number> {
  const { count } = await db.selectFrom('feedItem')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return count;
}

export async function countFeedMetadata(): Promise<number> {
  const { count } = await db.selectFrom('feedMetadata')
    .select((eb) => eb.fn.countAll<number>().as('count'))
    .executeTakeFirstOrThrow();
  return count;
}

export async function queryFeeds(): Promise<Feed[]> {
  const [feedMetadataList, categories] = await Promise.all([
    queryFeedMetadata({}),
    queryFeedCategory({}),
  ]);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const feeds: Feed[] = [];

  for (const feedMetadata of feedMetadataList) {
    const category = categoriesById.get(feedMetadata.category_id);
    if (!category) {
      console.error(`No category found for feed "${feedMetadata.title}" (category_id: ${feedMetadata.category_id})`);
      continue;
    }

    const items = await queryFeedItems({ feed_id: feedMetadata.id });
    feeds.push({ ...feedMetadata, items, category });
  }

  return feeds;
}
