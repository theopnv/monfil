import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { addFeedToDatabase } from '../db/crud/insert';
import { fetchUrl } from '../lib/fetch';
import { rssSource } from './sources/rss';
import type { ParsedSource } from './sources/types';
import { refreshAllFeeds } from './refresh';
import type { FeedItem } from '../db/types';

vi.mock(import('./sources/rss'), () => ({ rssSource: { type: 'rss' as const, fetch: vi.fn(), parse: vi.fn() } }));
vi.mock(import('../lib/fetch'), () => ({ fetchUrl: vi.fn() }));
vi.mock(import('../ipc/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));

const mockedFetchFeed = vi.mocked(rssSource.fetch);
const mockedFetchUrl = vi.mocked(fetchUrl);

type NewItem = Omit<FeedItem, 'id' | 'feed_id'>;

function item(overrides: Partial<NewItem> = {}): NewItem {
  const link = 'link' in overrides ? overrides.link : 'https://a.example/1';
  const title = overrides.title ?? 'Item';
  return {
    title,
    // The parser falls back to the link, then to a digest, when a feed supplies no guid. Mirror that here.
    guid: link ?? `monfil:test:${title}`,
    link,
    pubDate: '2024-01-01',
    description: '',
    image: undefined,
    author: undefined,
    extra: undefined,
    read_at: undefined,
    ...overrides,
  };
}

function parsed(link: string, items: NewItem[]): ParsedSource {
  return { type: 'rss', link, title: 'Feed A', description: '', items };
}

async function storeFeed(link: string, items: NewItem[] = []): Promise<number> {
  const result = await addFeedToDatabase({ link, title: `Feed at ${link}`, type: 'rss', items, categoryName: 'tech', showInHome: true });
  if (!result.success) {
    throw new Error('expected the feed to be stored');
  }
  return result.data.id;
}

function storedTitles(): Promise<string[]> {
  return db.selectFrom('feedItem').select('title').orderBy('id').execute().then((rows) => rows.map((row) => row.title));
}

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

beforeEach(() => {
  mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
});

afterEach(async () => {
  // Image enrichment outlives refreshAllFeeds on purpose; let it finish before the next test starts.
  await new Promise((resolve) => setImmediate(resolve));
  mockedFetchFeed.mockReset();
  mockedFetchUrl.mockReset();
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

  test('stores an item with no link once, however many cycles run', async () => {
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
    expect(await storedTitles()).toEqual(['Linkless item', 'Linked item']);
  });

  test('lets two feeds each hold an item with the same link', async () => {
    // Arrange
    const shared = 'https://shared.example/article';
    const linkA = 'https://a.example/feed';
    const linkB = 'https://b.example/feed';
    await storeFeed(linkA);
    await storeFeed(linkB);
    mockedFetchFeed.mockImplementation((requested: string) => Promise.resolve({
      success: true,
      data: parsed(requested, [item({ title: `From ${requested}`, link: shared })]),
    }));

    // Act
    await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual([`From ${linkA}`, `From ${linkB}`]);
  });

  test('records the failure on the feed row, then clears it once the fetch works again', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    mockedFetchFeed.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    await refreshAllFeeds();
    const failed = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    mockedFetchFeed.mockResolvedValue({ success: true, data: parsed(link, []) });
    await refreshAllFeeds();
    const recovered = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(failed.last_error).toBe('offline');
    expect(failed.last_fetched_at).toEqual(expect.any(String));
    expect(recovered.last_error).toBeNull();
    expect(recovered.last_fetched_at).toEqual(expect.any(String));
  });

  test('keeps refreshing the other feeds when one fetch fails', async () => {
    // Arrange
    const failingLink = 'https://a.example/feed';
    const workingLink = 'https://b.example/feed';
    await storeFeed(failingLink);
    await storeFeed(workingLink);
    mockedFetchFeed.mockImplementation((requested: string) => Promise.resolve(
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
    await vi.waitFor(() => expect(mockedFetchUrl).toHaveBeenCalled());

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(1);
    expect(mockedFetchUrl).toHaveBeenCalledWith('https://a.example/new', expect.any(AbortSignal));
  });
});
