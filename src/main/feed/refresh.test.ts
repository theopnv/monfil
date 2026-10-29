// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { setItemSaved } from '../db/saved';
import { deleteFeedFromDatabase } from '../db/crud/delete';
import { addFeedToDatabase } from '../db/crud/insert';
import { fetchText } from '../lib/fetch';
import { logger } from '../logging/logger';
import { rssSource } from './sources/rss';
import { HOME_WORKSPACE_ID, type ParsedSource } from '../../shared/contracts';
import { refreshAllFeeds, refreshFeeds } from './refresh';
import { broadcastToRenderers } from '../lib/sendToRenderer';
import type { FeedItem } from '../db/types';
import { ARTICLE_FETCH_TIMEOUT_MS } from '../lib/constants';
import { resolveSiteIcon } from './sources/siteIcon';

vi.mock(import('./sources/rss'), () => ({ rssSource: { type: 'rss' as const, fetchesFullArticle: true, matches: vi.fn(), discover: vi.fn(), fetch: vi.fn(), parse: vi.fn() } }));
vi.mock(import('../lib/fetch'), () => ({ fetchText: vi.fn() }));
vi.mock(import('./sources/siteIcon'), () => ({ resolveSiteIcon: vi.fn() }));
vi.mock(import('../lib/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));

const mockedFetchFeed = vi.mocked(rssSource.fetch);
const mockedFetchText = vi.mocked(fetchText);
const mockedResolveSiteIcon = vi.mocked(resolveSiteIcon);
const mockedBroadcast = vi.mocked(broadcastToRenderers);

type NewItem = Omit<FeedItem, 'id' | 'feed_id' | 'published_at' | 'excerpt'>;
const TEST_PUB_DATE = new Date().toISOString();

function item(overrides: Partial<NewItem> = {}): NewItem {
  const link = 'link' in overrides ? overrides.link : 'https://a.example/1';
  const title = overrides.title ?? 'Item';
  return {
    title,
    // The parser falls back to the link, then to a digest, when a feed supplies no guid. Mirror that here.
    guid: link ?? `monfil:test:${title}`,
    link,
    pubDate: TEST_PUB_DATE,
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
  mockedResolveSiteIcon.mockReset();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
});

describe('refreshAllFeeds', () => {
  test('stores the site icon of a feed that has none', async () => {
    // Arrange
    const link = 'https://moderne.example/feed.xml';
    const feedId = await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({ success: true, data: { ...fetched(link, []), parsed: { ...parsed(link, []), siteLink: 'https://moderne.example/blog' } } });
    mockedResolveSiteIcon.mockResolvedValue('https://moderne.example/brand/symbol.svg');

    // Act
    await refreshAllFeeds();

    // Assert
    expect(mockedResolveSiteIcon).toHaveBeenCalledWith('https://moderne.example/blog');
    expect(await db.selectFrom('feedMetadata').select('icon').where('id', '=', feedId).executeTakeFirstOrThrow()).toEqual({ icon: 'https://moderne.example/brand/symbol.svg' });
  });

  test('looks up a missing icon once per session', async () => {
    // Arrange
    const link = 'https://no-icon.example/feed.xml';
    await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, []) });
    mockedResolveSiteIcon.mockResolvedValue(undefined);

    // Act
    await refreshAllFeeds();
    await refreshAllFeeds();

    // Assert
    expect(mockedResolveSiteIcon).toHaveBeenCalledTimes(1);
    expect(mockedResolveSiteIcon).toHaveBeenCalledWith(link);
  });

  test('fetches a feed in full once when its icon is missing, so a 304 cannot skip the lookup', async () => {
    // Arrange
    const link = 'https://cached.example/feed.xml';
    const feedId = await storeFeed(link);
    await db.updateTable('feedMetadata').set({ etag: '"old"' }).where('id', '=', feedId).execute();
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, [], '"old"') });
    mockedResolveSiteIcon.mockResolvedValue('https://cached.example/favicon.ico');

    // Act
    await refreshAllFeeds();

    // Assert
    expect(mockedFetchFeed).toHaveBeenCalledWith({ link });
    expect(await db.selectFrom('feedMetadata').select('icon').where('id', '=', feedId).executeTakeFirstOrThrow()).toEqual({ icon: 'https://cached.example/favicon.ico' });
  });

  test('keeps the icon a feed already has', async () => {
    // Arrange
    const link = 'https://avatar.example/feed.xml';
    const stored = await addFeedToDatabase({ link, title: 'Avatar', type: 'rss', icon: 'https://cdn.example/avatar.png', items: [], categoryName: 'tech', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true });
    if (!stored.success) {
      throw new Error('expected the feed to be stored');
    }
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, []) });

    // Act
    await refreshAllFeeds();

    // Assert
    expect(mockedResolveSiteIcon).not.toHaveBeenCalled();
  });

  test('discards a feed response when its source was removed during the fetch', async () => {
    // Arrange
    const link = 'https://saved.example/feed';
    const feedId = await storeFeed(link, [item({ guid: 'saved' })]);
    const saved = await db.selectFrom('feedItem').select('id').where('feed_id', '=', feedId).executeTakeFirstOrThrow();
    await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId: saved.id, saved: true });
    let finish: ((value: Awaited<ReturnType<typeof rssSource.fetch>>) => void) | undefined;
    mockedFetchFeed.mockImplementation(() => new Promise((resolve) => {
      finish = resolve;
    }));
    const refreshing = refreshAllFeeds();
    await expect.poll(() => mockedFetchFeed.mock.calls.length).toBe(1);

    // Act
    await deleteFeedFromDatabase(feedId, HOME_WORKSPACE_ID);
    if (!finish) {
      throw new Error('Expected a pending feed fetch.');
    }
    finish({ success: true, data: fetched(link, [item({ guid: 'new', title: 'Late item' })]) });
    const summary = await refreshing;

    // Assert
    expect(await db.selectFrom('feedItem').select('id').execute()).toEqual([{ id: saved.id }]);
    expect(summary.failedFeeds).toBeUndefined();
  });

  test('does not fetch a feed that was removed while an earlier feed was being fetched', async () => {
    // Arrange
    const links = ['a', 'c', 'd', 'e', 'b'].map((name) => `https://${name}.example/feed`);
    const [linkA, , , , linkB] = links;
    const feedIds: number[] = [];
    for (const link of links) {
      feedIds.push(await storeFeed(link));
    }
    const removedId = feedIds[4] ?? 0;
    mockedFetchFeed.mockImplementation(async (input) => {
      if (input.link === linkA) {
        await deleteFeedFromDatabase(removedId, HOME_WORKSPACE_ID);
      }
      return { success: true, data: fetched(input.link, []) };
    });

    // Act
    const summary = await refreshAllFeeds();

    // Assert
    expect(mockedFetchFeed.mock.calls.map(([input]) => input.link)).not.toContain(linkB);
    expect(summary.failedFeeds).toBeUndefined();
  });

  test('does not fetch a removed source retained by Saved', async () => {
    // Arrange
    const feedId = await storeFeed('https://saved.example/feed', [item()]);
    const saved = await db.selectFrom('feedItem').select('id').where('feed_id', '=', feedId).executeTakeFirstOrThrow();
    await setItemSaved({ workspaceId: HOME_WORKSPACE_ID, itemId: saved.id, saved: true });
    await deleteFeedFromDatabase(feedId, HOME_WORKSPACE_ID);

    // Act
    const summary = await refreshAllFeeds(true);

    // Assert
    expect(mockedFetchFeed).not.toHaveBeenCalled();
    expect(summary.perFeed).toEqual([]);
    expect(await db.selectFrom('feedItem').select('id').execute()).toEqual([{ id: saved.id }]);
  });

  test('reports publisher edits and removes expired unread items', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link, [item({ guid: 'stable', title: 'Old' }), item({ guid: 'expired', title: 'Expired', pubDate: '2020-01-01' }), ...Array.from({ length: 10 }, (_, index) => item({ guid: `recent-${index}`, title: `Recent ${index}` }))]);
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, [item({ guid: 'stable', title: 'Edited', link: 'https://a.example/edited' }), item({ guid: 'old-fetch', title: 'Old fetch', pubDate: '2020-01-01' })]) });

    // Act
    const summary = await refreshAllFeeds();

    // Assert
    expect(summary.perFeed).toContainEqual({ feedId, inserted: 0, updated: 1 });
    expect(summary.removed).toBe(1);
    expect(await storedTitles()).toEqual(['Edited', ...Array.from({ length: 10 }, (_, index) => `Recent ${index}`)]);
  });

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

  test('keeps ten old entries from a newly fetched quiet source', async () => {
    // Arrange
    const link = 'https://quiet.example/feed';
    const feedId = await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, Array.from({ length: 12 }, (_, index) => item({ guid: `old-${index}`, link: `https://quiet.example/${index}`, pubDate: new Date(Date.now() - (365 + index) * 86400000).toISOString() }))) });

    // Act
    const summary = await refreshAllFeeds();

    // Assert
    expect(summary.perFeed).toContainEqual({ feedId, inserted: 10 });
    expect(await db.selectFrom('feedItem').select('guid').execute()).toHaveLength(10);
  });

  test('keeps the first fetch date for an undated item', async () => {
    // Arrange
    const link = 'https://undated.example/feed';
    const feedId = await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, [item({ guid: 'undated', pubDate: 'bad date' })]) });
    const first = Date.parse('2026-01-01T00:00:00Z');
    const clock = vi.spyOn(Date, 'now').mockReturnValue(first);

    // Act
    await refreshAllFeeds();
    clock.mockReturnValue(first + 86400000);
    await refreshAllFeeds();

    // Assert
    const stored = await db.selectFrom('feedItem').selectAll().where('feed_id', '=', feedId).executeTakeFirstOrThrow();
    expect(stored.published_at).toBe(first - 7 * 86400000);
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
    await db.updateTable('feedMetadata').set({ etag: '"old"', last_modified: 'Mon, 01 Jan 2024 00:00:00 GMT', icon: 'https://a.example/icon.png' }).where('id', '=', feedId).execute();
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, [], '"new"'),
    });

    // Act
    await refreshAllFeeds();
    const stored = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(mockedFetchFeed).toHaveBeenCalledWith({ link, validators: { etag: '"old"', last_modified: 'Mon, 01 Jan 2024 00:00:00 GMT' } });
    expect(stored.etag).toBe('"new"');
    expect(stored.last_modified).toBeNull();
  });

  test('fetches the full source when retention increases', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    await db.updateTable('feedMetadata').set({ etag: '"old"' }).where('id', '=', feedId).execute();
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, [item({ guid: 'history', pubDate: new Date(Date.now() - 45 * 86400000).toISOString() })]) });

    // Act
    const summary = await refreshAllFeeds(true);

    // Assert
    expect(mockedFetchFeed).toHaveBeenCalledWith({ link });
    expect(summary.perFeed).toContainEqual({ feedId, inserted: 1 });
  });

  test('keeps the stored validators when refreshed items cannot be inserted', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    await db.updateTable('feedMetadata').set({ etag: '"old"', icon: 'https://a.example/icon.png' }).where('id', '=', feedId).execute();
    const invalidItem = item({ title: null as unknown as string });
    mockedFetchFeed.mockResolvedValue({
      success: true,
      data: fetched(link, [invalidItem], '"new"'),
    });

    // Act
    const summary = await refreshAllFeeds();
    const stored = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(summary.failedFeeds).toEqual([{ feedId, title: `Feed at ${link}`, message: 'Could not save the new items.' }]);
    expect(stored.etag).toBe('"old"');
  });

  test('a 304 refresh counts as success with no items', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    await db.updateTable('feedMetadata').set({ etag: '"old"', icon: 'https://a.example/icon.png' }).where('id', '=', feedId).execute();
    mockedFetchFeed.mockResolvedValue({ success: true, data: { notModified: true } });

    // Act
    const summary = await refreshAllFeeds();
    const stored = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(summary.perFeed).toContainEqual({ feedId, inserted: 0 });
    expect(summary.failedFeeds).toBeUndefined();
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
    const failedSummary = await refreshAllFeeds();
    const failed = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, []) });
    const recoveredSummary = await refreshAllFeeds();
    const recovered = await db.selectFrom('feedMetadata').selectAll().where('id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(failedSummary.failedFeeds).toEqual([{ feedId, title: `Feed at ${link}`, message: 'offline' }]);
    expect(recoveredSummary.failedFeeds).toBeUndefined();
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

  test('shares the image enrichment budget across feeds', async () => {
    // Arrange
    const firstLink = 'https://a.example/feed';
    const secondLink = 'https://b.example/feed';
    await storeFeed(firstLink);
    await storeFeed(secondLink);
    mockedFetchFeed.mockImplementation((input) => Promise.resolve({
      success: true,
      data: fetched(input.link, Array.from({ length: input.link === firstLink ? 150 : 100 }, (_, index) => item({ title: `${input.link} ${index}`, link: `${input.link}/${index}` }))),
    }));

    // Act
    await refreshAllFeeds();
    await vi.waitFor(() => expect(mockedFetchText).toHaveBeenCalledTimes(200));
    await new Promise((resolve) => setTimeout(resolve, 20));

    // Assert
    expect(mockedFetchText).toHaveBeenCalledTimes(200);
    expect(mockedFetchText).toHaveBeenCalledWith(`${secondLink}/49`, expect.anything());
    expect(mockedFetchText).not.toHaveBeenCalledWith(`${secondLink}/50`, expect.anything());
  });

  test('stores and announces the image found for a new item', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const feedId = await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, [item({ title: 'New item', link: 'https://a.example/new' })]) });
    mockedFetchText.mockResolvedValue({ success: true, data: { body: '<html><head><meta property="og:image" content="https://a.example/cover.png"></head></html>', validators: { etag: undefined, last_modified: undefined } } });

    // Act
    await refreshAllFeeds();
    await vi.waitFor(() => expect(mockedBroadcast).toHaveBeenCalled());
    const stored = await db.selectFrom('feedItem').select(['id', 'image']).where('feed_id', '=', feedId).executeTakeFirstOrThrow();

    // Assert
    expect(mockedBroadcast).toHaveBeenCalledWith('feeds:item-image-fetched', { feedId, itemId: stored.id, image: 'https://a.example/cover.png' });
    await vi.waitFor(async () => {
      expect((await db.selectFrom('feedItem').select('image').where('id', '=', stored.id).executeTakeFirstOrThrow()).image).toBe('https://a.example/cover.png');
    });
  });

  test('does not look for images when the source already carries the full article', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    await storeFeed(link);
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, [item({ title: 'New item', link: 'https://a.example/new' })]) });
    Object.defineProperty(rssSource, 'fetchesFullArticle', { value: false, configurable: true });

    // Act
    try {
      await refreshAllFeeds();
      await new Promise((resolve) => setTimeout(resolve, 20));
    } finally {
      Object.defineProperty(rssSource, 'fetchesFullArticle', { value: true, configurable: true });
    }

    // Assert
    expect(mockedFetchText).not.toHaveBeenCalled();
  });
});

describe('refreshFeeds', () => {
  test('returns an empty summary without touching any feed when given no ids', async () => {
    // Arrange
    await storeFeed('https://a.example/feed');

    // Act
    const summary = await refreshFeeds([]);

    // Assert
    expect(summary).toEqual({ perFeed: [] });
    expect(mockedFetchFeed).not.toHaveBeenCalled();
  });

  test('fetches only the given feeds, with their stored validators', async () => {
    // Arrange
    const link = 'https://a.example/feed';
    const otherLink = 'https://b.example/feed';
    const feedId = await storeFeed(link);
    await storeFeed(otherLink);
    await db.updateTable('feedMetadata').set({ etag: '"old"', icon: 'https://a.example/icon.png' }).where('id', '=', feedId).execute();
    mockedFetchFeed.mockResolvedValue({ success: true, data: fetched(link, [item({ title: 'Fresh', link: 'https://a.example/1' })]) });

    // Act
    const summary = await refreshFeeds([feedId]);

    // Assert
    expect(mockedFetchFeed).toHaveBeenCalledTimes(1);
    expect(mockedFetchFeed).toHaveBeenCalledWith({ link, validators: { etag: '"old"', last_modified: undefined } });
    expect(summary.perFeed).toEqual([{ feedId, inserted: 1 }]);
  });
});
