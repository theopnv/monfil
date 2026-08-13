import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, dbReady } from '../database';
import { queryFeedCategory, queryFeedItems, queryFeedMetadata } from './query';

beforeAll(async () => {
  await dbReady;
});

afterEach(async () => {
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('queryFeedCategory', () => {
  test('returns every category when no criteria are given', async () => {
    await db.insertInto('feedCategory').values([{ name: 'tech' }, { name: 'news' }]).execute();

    const result = await queryFeedCategory({});

    expect(result.map((category) => category.name).sort()).toEqual(['news', 'tech']);
  });

  test('filters by name', async () => {
    await db.insertInto('feedCategory').values([{ name: 'tech' }, { name: 'news' }]).execute();

    const result = await queryFeedCategory({ name: 'tech' });

    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('tech');
  });

  test('returns an empty array when nothing matches', async () => {
    const result = await queryFeedCategory({ name: 'does-not-exist' });

    expect(result).toEqual([]);
  });
});

describe('queryFeedMetadata', () => {
  async function seedFeeds() {
    const category = await db
      .insertInto('feedCategory')
      .values({ name: 'tech' })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await db
      .insertInto('feedMetadata')
      .values([
        { link: 'https://a.example/feed', title: 'Feed A', category_id: category.id },
        { link: 'https://b.example/feed', title: 'Feed B', category_id: category.id },
      ])
      .execute();

    return category;
  }

  test('filters by link', async () => {
    await seedFeeds();

    const result = await queryFeedMetadata({ link: 'https://a.example/feed' });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Feed A');
  });

  test('filters by title', async () => {
    await seedFeeds();

    const result = await queryFeedMetadata({ title: 'Feed B' });

    expect(result).toHaveLength(1);
    expect(result[0]?.link).toBe('https://b.example/feed');
  });

  test('filters by category_id', async () => {
    const category = await seedFeeds();

    const result = await queryFeedMetadata({ category_id: category.id });

    expect(result).toHaveLength(2);
  });
});

describe('queryFeedItems', () => {
  async function seedItems() {
    const category = await db
      .insertInto('feedCategory')
      .values({ name: 'tech' })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    const feed = await db
      .insertInto('feedMetadata')
      .values({ link: 'https://a.example/feed', title: 'Feed A', category_id: category.id })
      .returning(['id'])
      .executeTakeFirstOrThrow();

    await db
      .insertInto('feedItem')
      .values([
        { feed_id: feed.id, title: 'Item 1', link: 'https://a.example/1', pubDate: '2024-01-01', description: 'Description 1' },
        { feed_id: feed.id, title: 'Item 2', link: 'https://a.example/2', pubDate: '2024-01-02', description: 'Description 2' },
      ])
      .execute();

    return feed;
  }

  test('filters by feed_id', async () => {
    const feed = await seedItems();

    const result = await queryFeedItems({ feed_id: feed.id });

    expect(result).toHaveLength(2);
  });

  test('filters by title', async () => {
    await seedItems();

    const result = await queryFeedItems({ title: 'Item 1' });

    expect(result).toHaveLength(1);
    expect(result[0]?.link).toBe('https://a.example/1');
  });

  test('filters by link', async () => {
    await seedItems();

    const result = await queryFeedItems({ link: 'https://a.example/2' });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Item 2');
  });

  test('filters by pubDate', async () => {
    await seedItems();

    const result = await queryFeedItems({ pubDate: '2024-01-01' });

    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Item 1');
  });

  test('returns an empty array when nothing matches', async () => {
    await seedItems();

    const result = await queryFeedItems({ title: 'does-not-exist' });

    expect(result).toEqual([]);
  });
});
