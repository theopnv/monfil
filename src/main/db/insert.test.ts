import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { db, dbReady } from '../database';
import { addFeedsToDatabase, addFeedToDatabase } from './insert';
import { fetchFeed } from '../feed/parse';

vi.mock(import('../feed/parse'), () => ({
  fetchFeed: vi.fn(),
}));

const mockedFetchFeed = vi.mocked(fetchFeed);

const feedA = { link: 'https://a.example/feed', title: 'Feed A', category: { name: 'tech' } };
const feedB = { link: 'https://b.example/feed', title: 'Feed B', category: { name: 'tech' } };

// One distinct item per feed link, so items from different feeds never collide
// on the feedItem.link unique constraint.
async function itemsFor(link: string) {
  return {
    success: true as const,
    data: {
      link,
      title: `${link} title`,
      description: `${link} feed description`,
      items: [{ title: `${link} item`, link: `${link}#1`, pubDate: '2024-01-01', description: `${link} description` }],
    },
  };
}

beforeAll(async () => {
  await dbReady;
});

afterEach(async () => {
  mockedFetchFeed.mockReset();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('addFeedsToDatabase', () => {
  test('inserts the category, metadata and items for a single feed', async () => {
    mockedFetchFeed.mockImplementation(itemsFor);

    await addFeedsToDatabase([feedA]);

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();
    const items = await db.selectFrom('feedItem').selectAll().execute();

    expect(categories).toHaveLength(1);
    expect(metadata).toHaveLength(1);
    expect(items).toHaveLength(1);
    expect(items[0]?.feed_id).toBe(metadata[0]?.id);
  });

  test('feeds that share a category only create one category row', async () => {
    mockedFetchFeed.mockResolvedValue({ success: true, data: { link: 'irrelevant', title: 'irrelevant', description: '', items: [] } });

    await addFeedsToDatabase([feedA, feedB]);

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();

    expect(categories).toHaveLength(1);
    expect(metadata).toHaveLength(2);
    expect(metadata.every((row) => row.category_id === categories[0]?.id)).toBe(true);
  });

  test('running it again for the same feeds does not throw or duplicate rows', async () => {
    mockedFetchFeed.mockImplementation(itemsFor);

    await addFeedsToDatabase([feedA, feedB]);
    await expect(addFeedsToDatabase([feedA, feedB])).resolves.not.toThrow();

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();
    const items = await db.selectFrom('feedItem').selectAll().execute();

    expect(categories).toHaveLength(1);
    expect(metadata).toHaveLength(2);
    expect(items).toHaveLength(2);
  });

  test('logs and skips item insertion when the feed fetch fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => { });
    mockedFetchFeed.mockResolvedValue({
      success: false,
      error: { name: 'NETWORK_ERROR', message: 'boom' },
    });

    await addFeedsToDatabase([feedA]);

    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();
    const items = await db.selectFrom('feedItem').selectAll().execute();

    expect(metadata).toHaveLength(1);
    expect(items).toHaveLength(0);
    expect(consoleError).toHaveBeenCalledWith(expect.stringContaining(feedA.link));

    consoleError.mockRestore();
  });

  test('items without a link do not conflict with each other', async () => {
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: {
        link: feedA.link,
        title: feedA.title,
        description: '',
        items: [
          { title: 'Item 1', link: undefined, pubDate: '2024-01-01', description: '' },
          { title: 'Item 2', link: undefined, pubDate: '2024-01-02', description: '' },
        ],
      },
    });

    await addFeedsToDatabase([feedA]);

    const items = await db.selectFrom('feedItem').selectAll().execute();
    expect(items).toHaveLength(2);
  });
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
