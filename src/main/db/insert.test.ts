import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { db, dbReady } from '../database';
import { addFeedsToDatabase } from './insert';
import { getFeedItems } from '../feed/parse';

vi.mock('../feed/parse', () => ({
  getFeedItems: vi.fn(),
}));

const mockedGetFeedItems = vi.mocked(getFeedItems);

const feedA = { link: 'https://a.example/feed', title: 'Feed A', category: { name: 'tech' } };
const feedB = { link: 'https://b.example/feed', title: 'Feed B', category: { name: 'tech' } };

// One distinct item per feed link, so items from different feeds never collide
// on the feedItem.link unique constraint.
async function itemsFor(link: string) {
  return { success: true as const, data: [{ title: `${link} item`, link: `${link}#1`, pubDate: '2024-01-01', description: `${link} description` }] };
}

beforeAll(async () => {
  await dbReady;
});

afterEach(async () => {
  mockedGetFeedItems.mockReset();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('addFeedsToDatabase', () => {
  test('inserts the category, metadata and items for a single feed', async () => {
    mockedGetFeedItems.mockImplementation(itemsFor);

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
    mockedGetFeedItems.mockResolvedValue({ success: true, data: [] });

    await addFeedsToDatabase([feedA, feedB]);

    const categories = await db.selectFrom('feedCategory').selectAll().execute();
    const metadata = await db.selectFrom('feedMetadata').selectAll().execute();

    expect(categories).toHaveLength(1);
    expect(metadata).toHaveLength(2);
    expect(metadata.every((row) => row.category_id === categories[0]?.id)).toBe(true);
  });

  test('running it again for the same feeds does not throw or duplicate rows', async () => {
    mockedGetFeedItems.mockImplementation(itemsFor);

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
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    mockedGetFeedItems.mockResolvedValue({
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
    mockedGetFeedItems.mockResolvedValue({
      success: true,
      data: [
        { title: 'Item 1', link: undefined, pubDate: '2024-01-01', description: '' },
        { title: 'Item 2', link: undefined, pubDate: '2024-01-02', description: '' },
      ],
    });

    await addFeedsToDatabase([feedA]);

    const items = await db.selectFrom('feedItem').selectAll().execute();
    expect(items).toHaveLength(2);
  });
});
