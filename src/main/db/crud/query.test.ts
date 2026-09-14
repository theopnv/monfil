import { beforeEach, afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../database';
import { countFeedItems, countFeedMetadata, queryArticleContent, queryFeedCategory, queryFeedItems, queryFeedMetadata, queryFeedSummaries, queryRiverPage } from './query';

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('articleContent').execute();
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

  test('filters by showInHome', async () => {
    // Arrange
    await db
      .insertInto('feedMetadata')
      .values({ link: 'https://c.example/feed', title: 'Feed C', category_id: category.id, showInHome: 0 })
      .execute();

    // Act
    const result = await queryFeedMetadata({ showInHome: 0 });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.title).toBe('Feed C');
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
        { feed_id: feed.id, title: 'Item 1', link: 'https://a.example/1', guid: 'https://a.example/1', pubDate: '2024-01-01', description: 'Description 1' },
        { feed_id: feed.id, title: 'Item 2', link: 'https://a.example/2', guid: 'https://a.example/2', pubDate: '2024-01-02', description: 'Description 2' },
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

describe('queryArticleContent', () => {
  async function createItem(): Promise<number> {
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
    const item = await db
      .insertInto('feedItem')
      .values({ feed_id: feed.id, title: 'Item 1', link: 'https://a.example/1', guid: 'https://a.example/1', pubDate: '2024-01-01', description: '' })
      .returning(['id'])
      .executeTakeFirstOrThrow();
    return item.id;
  }

  test('filters by item_id', async () => {
    // Arrange
    const itemId = await createItem();
    await db.insertInto('articleContent').values({ item_id: itemId, html: '<p>Body</p>', text: 'Body', word_count: 1, status: 'ok' }).execute();

    // Act
    const result = await queryArticleContent({ item_id: itemId });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.status).toBe('ok');
  });

  test('filters by status', async () => {
    // Arrange
    const itemId = await createItem();
    await db.insertInto('articleContent').values({ item_id: itemId, html: undefined, text: undefined, word_count: undefined, status: 'failed' }).execute();

    // Act
    const result = await queryArticleContent({ status: 'failed' });

    // Assert
    expect(result).toHaveLength(1);
    expect(result[0]?.item_id).toBe(itemId);
  });

  test('returns an empty array when nothing matches', async () => {
    // Act
    const result = await queryArticleContent({ item_id: 999999 });

    // Assert
    expect(result).toEqual([]);
  });
});

describe('countFeedMetadata', () => {
  test('counts every feed', async () => {
    // Arrange
    const category = await db.insertInto('feedCategory').values({ name: 'tech' }).returning(['id']).executeTakeFirstOrThrow();
    await db.insertInto('feedMetadata').values([
      { link: 'https://a.example/feed', title: 'Feed A', category_id: category.id },
      { link: 'https://b.example/feed', title: 'Feed B', category_id: category.id },
    ]).execute();

    // Act
    const result = await countFeedMetadata();

    // Assert
    expect(result).toBe(2);
  });

  test('returns 0 when there are no feeds', async () => {
    // Act
    const result = await countFeedMetadata();

    // Assert
    expect(result).toBe(0);
  });
});

describe('countFeedItems', () => {
  test('counts every item across every feed', async () => {
    // Arrange
    const category = await db.insertInto('feedCategory').values({ name: 'tech' }).returning(['id']).executeTakeFirstOrThrow();
    const feed = await db.insertInto('feedMetadata').values({ link: 'https://a.example/feed', title: 'Feed A', category_id: category.id }).returning(['id']).executeTakeFirstOrThrow();
    await db.insertInto('feedItem').values([
      { feed_id: feed.id, title: 'Item 1', link: 'https://a.example/1', guid: 'https://a.example/1', pubDate: '2024-01-01', description: '' },
      { feed_id: feed.id, title: 'Item 2', link: 'https://a.example/2', guid: 'https://a.example/2', pubDate: '2024-01-02', description: '' },
    ]).execute();

    // Act
    const result = await countFeedItems();

    // Assert
    expect(result).toBe(2);
  });

  test('returns 0 when there are no items', async () => {
    // Act
    const result = await countFeedItems();

    // Assert
    expect(result).toBe(0);
  });
});

async function seedFeed(overrides: Partial<{ title: string; link: string; showInHome: number; categoryName: string }> = {}): Promise<number> {
  const category = await db.insertInto('feedCategory')
    .values({ name: overrides.categoryName ?? 'tech' })
    .onConflict((oc) => oc.column('name').doUpdateSet((eb) => ({ name: eb.ref('excluded.name') })))
    .returning(['id'])
    .executeTakeFirstOrThrow();
  const feed = await db.insertInto('feedMetadata')
    .values({
      link: overrides.link ?? 'https://a.example/feed',
      title: overrides.title ?? 'Feed A',
      category_id: category.id,
      showInHome: overrides.showInHome ?? 1,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return feed.id;
}

let seedItemCounter = 0;

async function seedItem(feedId: number, overrides: Partial<{ title: string; publishedAt: number; excerpt: string; readAt: string; description: string }> = {}): Promise<number> {
  seedItemCounter += 1;
  const guid = `guid-${seedItemCounter}`;
  const item = await db.insertInto('feedItem')
    .values({
      feed_id: feedId,
      title: overrides.title ?? 'Item',
      link: `https://a.example/${guid}`,
      guid,
      pubDate: '2024-01-01',
      description: overrides.description ?? '',
      published_at: overrides.publishedAt ?? 0,
      excerpt: overrides.excerpt ?? '',
      read_at: overrides.readAt,
    })
    .returning(['id'])
    .executeTakeFirstOrThrow();
  return item.id;
}

describe('queryFeedSummaries', () => {
  test('reports zero counts for a feed with no items', async () => {
    // Arrange
    await seedFeed();

    // Act
    const [summary] = await queryFeedSummaries();

    // Assert
    expect(summary).toMatchObject({ itemCount: 0, unreadCount: 0 });
  });

  test('separates the item count from the unread count', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { readAt: '2024-01-02T00:00:00.000Z' });
    await seedItem(feedId);

    // Act
    const [summary] = await queryFeedSummaries();

    // Assert
    expect(summary).toMatchObject({ itemCount: 2, unreadCount: 1 });
  });

  test('counts every item as unread when none are read', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId);
    await seedItem(feedId);

    // Act
    const [summary] = await queryFeedSummaries();

    // Assert
    expect(summary).toMatchObject({ itemCount: 2, unreadCount: 2 });
  });

  test('includes the category alongside the feed', async () => {
    // Arrange
    await seedFeed();

    // Act
    const [summary] = await queryFeedSummaries();

    // Assert
    expect(summary?.category.name).toBe('tech');
  });

  test('returns an empty array when there are no feeds', async () => {
    // Act
    const result = await queryFeedSummaries();

    // Assert
    expect(result).toEqual([]);
  });
});

describe('queryRiverPage', () => {
  test('returns rows newest first, with a cursor when more remain', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Oldest', publishedAt: 1 });
    await seedItem(feedId, { title: 'Middle', publishedAt: 2 });
    await seedItem(feedId, { title: 'Newest', publishedAt: 3 });

    // Act
    const page = await queryRiverPage({ limit: 2 });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Newest', 'Middle']);
    expect(page.nextCursor).toEqual({ publishedAt: 2, id: page.rows[1]?.id });
  });

  test('continues from a cursor without repeating or skipping rows', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Oldest', publishedAt: 1 });
    await seedItem(feedId, { title: 'Middle', publishedAt: 2 });
    await seedItem(feedId, { title: 'Newest', publishedAt: 3 });
    const firstPage = await queryRiverPage({ limit: 2 });

    // Act
    const secondPage = await queryRiverPage({ limit: 2, ...(firstPage.nextCursor ? { cursor: firstPage.nextCursor } : {}) });

    // Assert
    expect(secondPage.rows.map((row) => row.title)).toEqual(['Oldest']);
    expect(secondPage.nextCursor).toBeUndefined();
  });

  test('omits the cursor when exactly `limit` rows remain', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { publishedAt: 1 });
    await seedItem(feedId, { publishedAt: 2 });

    // Act
    const page = await queryRiverPage({ limit: 2 });

    // Assert
    expect(page.rows).toHaveLength(2);
    expect(page.nextCursor).toBeUndefined();
  });

  test('breaks a tie on the same published_at by id, descending', async () => {
    // Arrange
    const feedId = await seedFeed();
    const firstId = await seedItem(feedId, { title: 'First inserted', publishedAt: 5 });
    const secondId = await seedItem(feedId, { title: 'Second inserted', publishedAt: 5 });

    // Act
    const page = await queryRiverPage({ limit: 10 });

    // Assert
    expect(page.rows.map((row) => row.id)).toEqual([secondId, firstId]);
  });

  test('filters to the given feed ids', async () => {
    // Arrange
    const feedA = await seedFeed({ link: 'https://a.example/feed', title: 'Feed A' });
    const feedB = await seedFeed({ link: 'https://b.example/feed', title: 'Feed B' });
    await seedItem(feedA, { title: 'From A' });
    await seedItem(feedB, { title: 'From B' });

    // Act
    const page = await queryRiverPage({ limit: 10, feedIds: [feedA] });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['From A']);
  });

  test('defaults to feeds with showInHome when no feedIds are given', async () => {
    // Arrange
    const shown = await seedFeed({ link: 'https://a.example/feed', title: 'Shown', showInHome: 1 });
    const hidden = await seedFeed({ link: 'https://b.example/feed', title: 'Hidden', showInHome: 0 });
    await seedItem(shown, { title: 'Visible' });
    await seedItem(hidden, { title: 'Not visible' });

    // Act
    const page = await queryRiverPage({ limit: 10 });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Visible']);
  });

  test('filters to exact ids regardless of the default feed filter', async () => {
    // Arrange
    const feedId = await seedFeed({ showInHome: 0 });
    const targetId = await seedItem(feedId, { title: 'Deep link target' });
    await seedItem(feedId, { title: 'Not requested' });

    // Act
    const page = await queryRiverPage({ limit: 10, feedIds: [feedId], ids: [targetId] });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Deep link target']);
  });

  test('filters to unread items only', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Read', readAt: '2024-01-02T00:00:00.000Z' });
    await seedItem(feedId, { title: 'Unread' });

    // Act
    const page = await queryRiverPage({ limit: 10, unreadOnly: true });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Unread']);
  });

  test('requires every search word to match', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: 'Rust programming', excerpt: 'a systems language' });
    await seedItem(feedId, { title: 'Rust only' });

    // Act
    const page = await queryRiverPage({ limit: 10, search: 'rust systems' });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['Rust programming']);
  });

  test('matches a search word against the feed title alone', async () => {
    // Arrange
    const feedId = await seedFeed({ title: 'Distinctive Feed Name' });
    await seedItem(feedId, { title: 'Unrelated title', excerpt: 'unrelated excerpt' });

    // Act
    const page = await queryRiverPage({ limit: 10, search: 'distinctive' });

    // Assert
    expect(page.rows).toHaveLength(1);
  });

  test('treats % in the search string as a literal character', async () => {
    // Arrange
    const feedId = await seedFeed();
    await seedItem(feedId, { title: '50% off sale' });
    await seedItem(feedId, { title: 'Full price' });

    // Act
    const page = await queryRiverPage({ limit: 10, search: '50%' });

    // Assert
    expect(page.rows.map((row) => row.title)).toEqual(['50% off sale']);
  });

  test('returns an empty page for an empty database', async () => {
    // Act
    const page = await queryRiverPage({ limit: 10 });

    // Assert
    expect(page).toEqual({ rows: [] });
  });
});
