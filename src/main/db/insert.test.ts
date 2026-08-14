import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, dbReady } from '../database';
import { addFeedToDatabase, type NewFeedInput } from './insert';

const feedA: NewFeedInput = { link: 'https://a.example/feed', title: 'Feed A', items: [], categoryName: 'tech', showInHome: true };
const feedB: NewFeedInput = { link: 'https://b.example/feed', title: 'Feed B', items: [], categoryName: 'tech', showInHome: true };

beforeAll(async () => {
  await dbReady;
});

afterEach(async () => {
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('addFeedToDatabase', () => {
  test('inserts the category, metadata and items in one call', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [{ title: 'Item 1', link: `${feedA.link}#1`, pubDate: '2024-01-01', description: 'Item 1 description' }],
      categoryName: 'tech',
      showInHome: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe(feedA.title);
    expect(result.data.category.name).toBe('tech');
    expect(result.data.showInHome).toBe(1);
    expect(result.data.items).toHaveLength(1);
    expect(result.data.items[0]?.title).toBe('Item 1');
  });

  test('feeds that share a category only create one category row', async () => {
    await addFeedToDatabase(feedA);
    await addFeedToDatabase(feedB);

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();

    expect(categories).toHaveLength(1);
    expect(metadata).toHaveLength(2);
    expect(metadata.every((row) => row.category_id === categories[0]?.id)).toBe(true);
  });

  test('items without a link do not conflict with each other', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [
        { title: 'Item 1', link: undefined, pubDate: '2024-01-01', description: '' },
        { title: 'Item 2', link: undefined, pubDate: '2024-01-02', description: '' },
      ],
      categoryName: 'tech',
      showInHome: true,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.items).toHaveLength(2);
  });

  test('resubmitting the same link updates the row instead of duplicating it', async () => {
    await addFeedToDatabase({
      link: feedA.link,
      title: 'Old title',
      items: [],
      categoryName: 'tech',
      showInHome: true,
    });

    const result = await addFeedToDatabase({
      link: feedA.link,
      title: 'New title',
      items: [],
      categoryName: 'tech',
      showInHome: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.title).toBe('New title');
    expect(result.data.showInHome).toBe(0);

    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();
    expect(metadata).toHaveLength(1);
  });

  test('persists showInHome as 0 when false', async () => {
    const result = await addFeedToDatabase({
      link: feedA.link,
      title: feedA.title,
      items: [],
      categoryName: 'tech',
      showInHome: false,
    });

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.showInHome).toBe(0);
  });
});
