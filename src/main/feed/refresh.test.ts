import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../database';
import { addFeedToDatabase } from '../db/insert';
import { fetchArticleImage } from './fetchArticleImage';
import { fetchFeed } from './parse';
import type { ParsedFeed } from './parse';
import { refreshAllFeeds } from './refresh';
import type { FeedItem } from '../db/types';

vi.mock(import('./parse'), () => ({ fetchFeed: vi.fn() }));
vi.mock(import('./fetchArticleImage'), () => ({ fetchArticleImage: vi.fn() }));
vi.mock(import('../ipc/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));

const mockedFetchFeed = vi.mocked(fetchFeed);
const mockedFetchArticleImage = vi.mocked(fetchArticleImage);

type NewItem = Omit<FeedItem, 'id' | 'feed_id'>;

function item(overrides: Partial<NewItem> = {}): NewItem {
  return { title: 'Item', link: 'https://a.example/1', pubDate: '2024-01-01', description: '', image: undefined, ...overrides };
}

function parsed(link: string, items: NewItem[]): ParsedFeed {
  return { link, title: 'Feed A', description: '', items };
}

async function storeFeed(link: string, items: NewItem[] = []): Promise<number> {
  const result = await addFeedToDatabase({ link, title: `Feed at ${link}`, items, categoryName: 'tech', showInHome: true });
  if (!result.success) throw new Error('expected the feed to be stored');
  return result.data.id;
}

function storedTitles(): Promise<string[]> {
  return db.selectFrom('feedItem').select('title').orderBy('id').execute().then((rows) => rows.map((row) => row.title));
}

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

beforeEach(() => {
  mockedFetchArticleImage.mockResolvedValue(undefined);
});

afterEach(async () => {
  // Image enrichment outlives refreshAllFeeds on purpose; let it finish before the next test starts.
  await new Promise((resolve) => setImmediate(resolve));
  mockedFetchFeed.mockReset();
  mockedFetchArticleImage.mockReset();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('refreshAllFeeds', () => {
  test('stores the items published since the feed was added', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link, [item({ title: 'Old item', link: 'https://a.example/old' })]);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: parsed(link, [
        item({ title: 'Old item', link: 'https://a.example/old' }),
        item({ title: 'New item', link: 'https://a.example/new' }),
      ]),
    });

    // Act
    const feeds = await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual(['Old item', 'New item']);
    expect(feeds[0]?.items.map((stored) => stored.title)).toEqual(['Old item', 'New item']);
  });

  test('does not duplicate an item that is already stored', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link, [item({ title: 'Old item', link: 'https://a.example/old' })]);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: parsed(link, [item({ title: 'Old item', link: 'https://a.example/old' })]),
    });

    // Act
    await refreshAllFeeds();
    await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual(['Old item']);
  });

  test('skips an item with no link, so repeated cycles do not pile up copies', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: parsed(link, [
        item({ title: 'Linkless item', link: undefined }),
        item({ title: 'Linked item', link: 'https://a.example/linked' }),
      ]),
    });

    // Act
    await refreshAllFeeds();
    await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual(['Linked item']);
  });

  test('keeps refreshing the other feeds when one fetch fails', async () => {
    // Arrange
    const failingLink = 'https://a.example/feed';
    const workingLink = 'https://b.example/feed';
    await storeFeed(failingLink);
    await storeFeed(workingLink);
    mockedFetchFeed.mockImplementation((requested) => Promise.resolve(
      requested === failingLink
        ? { success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } }
        : { success: true, data: parsed(workingLink, [item({ title: 'From the working feed', link: 'https://b.example/1' })]) },
    ));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual(['From the working feed']);
  });

  test('fetches nothing and returns an empty list when no feed is stored', async () => {
    // Act
    const feeds = await refreshAllFeeds();

    // Assert
    expect(feeds).toEqual([]);
    expect(mockedFetchFeed).not.toHaveBeenCalled();
  });

  test('looks for an image only for the newly inserted items', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link, [item({ title: 'Old item', link: 'https://a.example/old' })]);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: parsed(link, [
        item({ title: 'Old item', link: 'https://a.example/old' }),
        item({ title: 'New item', link: 'https://a.example/new' }),
      ]),
    });

    // Act
    await refreshAllFeeds();
    await vi.waitFor(() => expect(mockedFetchArticleImage).toHaveBeenCalled());

    // Assert
    expect(mockedFetchArticleImage).toHaveBeenCalledTimes(1);
    expect(mockedFetchArticleImage).toHaveBeenCalledWith('https://a.example/new');
  });
});
