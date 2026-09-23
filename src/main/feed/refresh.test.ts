import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { addFeedToDatabase } from '../db/crud/insert';
import { fetchText } from '../lib/fetch';
import { logger } from '../logging/logger';
import { rssSource } from './sources/rss';
import { HOME_WORKSPACE_ID, type ParsedSource } from '../../shared/contracts';
import { refreshAllFeeds } from './refresh';
import type { FeedItem } from '../db/types';
import { ARTICLE_FETCH_TIMEOUT_MS } from '../constants';

vi.mock(import('./sources/rss'), () => ({ rssSource: { type: 'rss' as const, fetchesFullArticle: true, fetch: vi.fn(), parse: vi.fn() } }));
vi.mock(import('../lib/fetch'), () => ({ fetchText: vi.fn() }));
vi.mock(import('../ipc/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));

const mockedFetchFeed = vi.mocked(rssSource.fetch);
const mockedFetchText = vi.mocked(fetchText);

type NewItem = Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>;

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
  return { type: 'rss', link, title: 'Feed A', description: '', items, icon: undefined };
}

function fetched(link: string, items: NewItem[], etag?: string, lastModified?: string): { parsed: ParsedSource; validators: { etag: string | undefined; last_modified: string | undefined } } {
  return { parsed: parsed(link, items), validators: { etag, last_modified: lastModified } };
}

async function storeFeed(link: string, items: NewItem[] = []): Promise<number> {
  const result = await addFeedToDatabase({ link, title: `Feed at ${link}`, type: 'rss', items, categoryName: 'tech', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true });
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
  mockedFetchText.mockResolvedValue({ success: true, data: { body: '<html></html>', validators: { etag: undefined, last_modified: undefined } } });
});

afterEach(async () => {
  // Image enrichment outlives refreshAllFeeds on purpose; let it finish before the next test starts.
  await new Promise((resolve) => setImmediate(resolve));
  vi.restoreAllMocks();
  mockedFetchFeed.mockReset();
  mockedFetchText.mockReset();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('refreshAllFeeds', () => {
  test('stores the items published since the feed was added', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link, [item({ title: 'Old item', link: 'https://a.example/old' })]);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, [
        item({ title: 'Old item', link: 'https://a.example/old' }),
        item({ title: 'New item', link: 'https://a.example/new' }),
      ]),
    });

    // Act
    const summary = await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual(['Old item', 'New item']);
    expect(summary.perFeed).toContainEqual({ feedId, inserted: 1 });
  });

  test('does not duplicate an item that is already stored', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link, [item({ title: 'Old item', link: 'https://a.example/old' })]);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, [item({ title: 'Old item', link: 'https://a.example/old' })]),
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
      data: fetched(link, [
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
    mockedFetchFeed.mockImplementation((input) => Promise.resolve({
      success: true,
      data: fetched(input.link, [item({ title: `From ${input.link}`, link: shared })]),
    }));

    // Act
    await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual([`From ${linkA}`, `From ${linkB}`]);
  });

  test('sends the stored validators to the source and stores the fresh ones', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    await db.updateTable('feedMetadata').set({ etag: '"old"', last_modified: 'Mon, 01 Jan 2024 00:00:00 GMT' }).where('id', '=', feedId).execute();
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, [], '"new"'),
    });

    // Act
    await refreshAllFeeds();
    const stored = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(mockedFetchFeed).toHaveBeenCalledWith({ link, maxItems: 30, validators: { etag: '"old"', last_modified: 'Mon, 01 Jan 2024 00:00:00 GMT' } });
    expect(stored.etag).toBe('"new"');
    expect(stored.last_modified).toBeNull();
  });

  test('keeps the stored validators when refreshed items cannot be inserted', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    await db.updateTable('feedMetadata').set({ etag: '"old"' }).where('id', '=', feedId).execute();
    const invalidItem = item({ title: null as unknown as string });
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, [invalidItem], '"new"'),
    });

    // Act
    const summary = await refreshAllFeeds();
    const stored = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(summary.failedFeedIds).toContain(feedId);
    expect(stored.etag).toBe('"old"');
  });

  test('a 304 refresh counts as success with no items', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    await db.updateTable('feedMetadata').set({ etag: '"old"' }).where('id', '=', feedId).execute();
    mockedFetchFeed.mockResolvedValue({ success: true, data: { notModified: true } });

    // Act
    const summary = await refreshAllFeeds();
    const stored = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(summary.perFeed).toContainEqual({ feedId, inserted: 0 });
    expect(summary.failedFeedIds).toBeUndefined();
    expect(stored.etag).toBe('"old"');
    expect(stored.last_error).toBeNull();
    expect(stored.last_fetched_at).toEqual(expect.any(String));
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

    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, []) });
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
    mockedFetchFeed.mockImplementation((input) => Promise.resolve(
      input.link === failingLink
        ? { success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } }
        : { success: true, data: fetched(workingLink, [item({ title: 'From the working feed', link: 'https://b.example/1' })]) },
    ));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);

    // Act
    await refreshAllFeeds();

    // Assert
    expect(await storedTitles()).toEqual(['From the working feed']);
  });

  test('fetches nothing and returns an empty summary when no feed is stored', async () => {
    // Act
    const summary = await refreshAllFeeds();

    // Assert
    expect(summary).toEqual({ perFeed: [] });
    expect(mockedFetchFeed).not.toHaveBeenCalled();
  });

  test('looks for an image only for the newly inserted items', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link, [item({ title: 'Old item', link: 'https://a.example/old' })]);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, [
        item({ title: 'Old item', link: 'https://a.example/old' }),
        item({ title: 'New item', link: 'https://a.example/new' }),
      ]),
    });

    // Act
    await refreshAllFeeds();
    await vi.waitFor(() => expect(mockedFetchText).toHaveBeenCalled());

    // Assert
    expect(mockedFetchText).toHaveBeenCalledTimes(1);
    expect(mockedFetchText).toHaveBeenCalledWith('https://a.example/new', { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true });
  });

  test('keeps enriching later feeds when an item fails', async () => {
    // Arrange
    const failingLink = 'https://a.example/feed';
    const workingLink = 'https://b.example/feed';
    await storeFeed(failingLink);
    await storeFeed(workingLink);
    mockedFetchFeed.mockImplementation((input) => Promise.resolve({
      success: true,
      data: fetched(input.link, [item({ title: input.link, link: `${input.link}/1` })]),
    }));
    mockedFetchText.mockImplementation(async (link) => {
      if (link === `${failingLink}/1`) {
        throw new Error('page failed');
      }
      return { success: true, data: { body: '<html></html>', validators: { etag: undefined, last_modified: undefined } } };
    });
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);

    // Act
    await refreshAllFeeds();
    await vi.waitFor(() => expect(mockedFetchText).toHaveBeenCalledTimes(2));

    // Assert
    expect(mockedFetchText.mock.calls.map(([link]) => link)).toEqual([`${failingLink}/1`, `${workingLink}/1`]);
  });

  test('limits image enrichment to 200 new items per refresh', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, Array.from({ length: 201 }, (_, index) => item({ title: `Item ${index}`, link: `https://a.example/${index}` }))),
    });

    // Act
    await refreshAllFeeds();
    await vi.waitFor(() => expect(mockedFetchText).toHaveBeenCalledTimes(200));

    // Assert
    expect(mockedFetchText).not.toHaveBeenCalledWith('https://a.example/200', expect.anything());
  });
});
