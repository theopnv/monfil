import { beforeEach, afterEach, beforeAll, describe, expect, test } from 'vitest';
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
    // Arrange
    await db.insertInto('feedCategory').values([{ name: 'tech' }, { name: 'news' }]).execute();

    // Act
    const result = await queryFeedCategory({});

    // Assert
    expect(result.map((category) => category.name).sort()).toEqual(['news', 'tech']);
  });

  test('filters by name', async () => {
    // Arrange
    await db.insertInto('feedCategory').values([{ name: 'tech' }, { name: 'news' }]).execute();

    // Act
    const result = await queryFeedCategory({ name: 'tech' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.name).toBe('tech');
  });

  test('returns an empty array when nothing matches', async () => {
    // Arrange
    const result = await queryFeedCategory({ name: 'does-not-exist' });

    // Assert
    expect(result).toEqual([]);
  });
});

describe('queryFeedMetadata', () => {
  let category: { id: number; };

  beforeEach(async () => {
    category = await db
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
  });

  test('filters by link', async () => {
    // Act
    const result = await queryFeedMetadata({ link: 'https://a.example/feed' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Feed A');
  });

  test('filters by title', async () => {
    // Act
    const result = await queryFeedMetadata({ title: 'Feed B' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.link).toBe('https://b.example/feed');
  });

  test('filters by category_id', async () => {
    // Act
    const result = await queryFeedMetadata({ category_id: category.id });

    // Assert
    expect(result).toHaveLength(2);
  });
});

describe('queryFeedItems', () => {
  let feed: { id: number; };

  beforeEach(async () => {
    const category = await db
      .insertInto('feedCategory')
      .values({ name: 'tech' })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    feed = await db
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
  });

  test('filters by feed_id', async () => {
    // Act
    const result = await queryFeedItems({ feed_id: feed.id });

    // Assert
    expect(result).toHaveLength(2);
  });

  test('filters by title', async () => {
    // Act
    const result = await queryFeedItems({ title: 'Item 1' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.link).toBe('https://a.example/1');
  });

  test('filters by link', async () => {
    // Act
    const result = await queryFeedItems({ link: 'https://a.example/2' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Item 2');
  });

  test('filters by pubDate', async () => {
    // Act
    const result = await queryFeedItems({ pubDate: '2024-01-01' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Item 1');
  });

  test('returns an empty array when nothing matches', async () => {
    // Act
    const result = await queryFeedItems({ title: 'does-not-exist' });

    // Assert
    expect(result).toEqual([]);
  });
});
