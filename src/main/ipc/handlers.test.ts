// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { addFeedToDatabase, createCategory, createWorkspace, upsertArticleContent } from '../db/crud/insert';
import { updateWorkspace } from '../db/crud/update';
import { createSavedSearch, updateSavedSearch } from '../db/crud/searches';
import { getDetailedLogging, getRefreshInterval, getRetentionDays, setRetentionDays } from '../app/settings';
import { setDetailedLogging as applyDetailedLogging, logger } from '../logging/logger';
import { fetchText } from '../lib/fetch';
import { extractArticleInUtilityProcess } from '../feed/extractArticleUtility';
import { enrichItems } from '../feed/enrichItems';
import { refreshAllFeeds } from '../feed/refresh';
import { rescheduleRefresh } from '../feed/scheduler';
import { broadcastToRenderers, sendToRenderer } from '../lib/sendToRenderer';
import {
  handleAppHintsEnabled, handleFeedsListCategories, handleFeedsSubmitAddFeed, handleItemsGetContent, handleSearchesUpdate,
  handleSettingsSetDetailedLogging, handleSettingsSetRefreshInterval, handleSettingsSetRetentionDays, handleWorkspacesUpdate,
} from './handlers';
import { ARTICLE_FETCH_TIMEOUT_MS } from '../lib/constants';
import type { IpcMainInvokeEvent } from 'electron';
import { HOME_WORKSPACE_ID, type SourceType } from '../../shared/contracts';

vi.mock(import('../lib/fetch'), () => ({ fetchText: vi.fn() }));
vi.mock(import('../feed/extractArticleUtility'), () => ({ extractArticleInUtilityProcess: vi.fn() }));
vi.mock(import('../feed/enrichItems'), () => ({ enrichItems: vi.fn() }));
vi.mock(import('../feed/refresh'), () => ({ refreshAllFeeds: vi.fn() }));
vi.mock(import('../feed/scheduler'), () => ({ rescheduleRefresh: vi.fn() }));
vi.mock(import('../lib/sendToRenderer'), () => ({ sendToRenderer: vi.fn(), broadcastToRenderers: vi.fn() }));
vi.mock(import('../db/crud/update'), { spy: true });
vi.mock(import('../db/crud/searches'), { spy: true });
vi.mock(import('../logging/logger'), { spy: true });

const mockedFetchText = vi.mocked(fetchText);
const mockedExtractArticleInUtilityProcess = vi.mocked(extractArticleInUtilityProcess);
const fakeEvent = {} as IpcMainInvokeEvent;
const DAY_MS = 86_400_000;

const PARAGRAPH = 'This is a long paragraph about something interesting that readers care about deeply. '.repeat(6);
const ARTICLE_PAGE_HTML = `<!doctype html>
<html><head><title>An Article</title></head>
<body><article><h1>An Article</h1>
<p>${PARAGRAPH}</p>
<p>Another paragraph continues the story with more detail and context for the reader to enjoy.</p>
</article></body></html>`;

async function createItem(link: string | undefined, options: { type?: SourceType; description?: string; feedLink?: string } = {}): Promise<number> {
  const result = await addFeedToDatabase({
    link: options.feedLink ?? 'https://a.example/feed',
    title: 'Feed A',
    items: [{ title: 'Item', link, guid: link ?? 'monfil:test:linkless', pubDate: '2024-01-01', description: options.description ?? '', image: undefined, author: undefined, extra: undefined, read_at: undefined }],
    type: options.type ?? 'rss',
    categoryName: 'tech',
    workspaceId: HOME_WORKSPACE_ID,
    showInWorkspace: true,
  });
  if (!result.success) {
    throw new Error('expected the feed to be created');
  }
  const itemId = result.data.items[0]?.id;
  if (itemId === undefined) {
    throw new Error('expected an item id');
  }
  return itemId;
}

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  mockedFetchText.mockReset();
  mockedExtractArticleInUtilityProcess.mockReset();
  vi.mocked(enrichItems).mockReset();
  vi.mocked(refreshAllFeeds).mockReset();
  vi.mocked(rescheduleRefresh).mockReset();
  vi.mocked(sendToRenderer).mockReset();
  vi.mocked(broadcastToRenderers).mockReset();
  vi.mocked(updateWorkspace).mockClear();
  vi.mocked(updateSavedSearch).mockClear();
  vi.mocked(applyDetailedLogging).mockClear();
  vi.restoreAllMocks();
  await db.deleteFrom('articleContent').execute();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
  await db.deleteFrom('savedSearch').execute();
  await db.deleteFrom('setting').execute();
  await db.deleteFrom('workspace').where('id', '!=', HOME_WORKSPACE_ID).execute();
});

describe('handleItemsGetContent', () => {
  test('returns a stored "ok" row without fetching', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    await upsertArticleContent({ item_id: itemId, html: '<p>Stored</p>', text: 'Stored', word_count: 1, status: 'ok' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: '', article: { html: '<p>Stored</p>', wordCount: 1 } });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('leaves out the article for a stored "failed" row without fetching again', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    await upsertArticleContent({ item_id: itemId, html: undefined, text: undefined, word_count: undefined, status: 'failed' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('leaves out the article for a stored "too_short" row without fetching again', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    await upsertArticleContent({ item_id: itemId, html: '<p>x</p>', text: 'x', word_count: 1, status: 'too_short' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('a missing row fetches, extracts, stores and returns the article', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/long-article');
    mockedFetchText.mockResolvedValue({ success: true, data: { body: ARTICLE_PAGE_HTML, validators: { etag: undefined, last_modified: undefined } } });
    mockedExtractArticleInUtilityProcess.mockResolvedValue({ html: '<p>Full article</p>', text: PARAGRAPH, wordCount: 80 });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(mockedFetchText).toHaveBeenCalledWith('https://a.example/long-article', { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true });
    expect(mockedExtractArticleInUtilityProcess).toHaveBeenCalledWith(ARTICLE_PAGE_HTML, 'https://a.example/long-article');
    expect(result.article).toEqual({ html: '<p>Full article</p>', wordCount: 80 });
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('ok');
    expect(stored.html).toContain('<p>');
  });

  test('a fetch failure stores a "failed" row and leaves out the article', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    mockedFetchText.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('failed');
    expect(mockedExtractArticleInUtilityProcess).not.toHaveBeenCalled();
  });

  test('an item with no link returns its description without fetching', async () => {
    // Arrange
    const itemId = await createItem(undefined, { description: 'Fallback text' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: 'Fallback text', article: undefined });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('an unknown item id returns an empty body without fetching', async () => {
    // Act
    const result = await handleItemsGetContent(fakeEvent, 999999);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('a source that does not fetch full articles skips extraction entirely', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/video', { type: 'youtube', description: 'Video description' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: 'Video description', article: undefined });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });
});

describe('handleAppHintsEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('is on by default', () => {
    // Arrange
    vi.stubEnv('MONFIL_HINTS', undefined);

    // Act & Assert
    expect(handleAppHintsEnabled()).toBe(true);
  });

  test('is on when MONFIL_HINTS is on', () => {
    // Arrange
    vi.stubEnv('MONFIL_HINTS', 'on');

    // Act & Assert
    expect(handleAppHintsEnabled()).toBe(true);
  });

  test('is off when MONFIL_HINTS is off', () => {
    // Arrange
    vi.stubEnv('MONFIL_HINTS', 'off');

    // Act & Assert
    expect(handleAppHintsEnabled()).toBe(false);
  });
});

describe('handleItemsGetContent with several items', () => {
  test('answers for the item asked for, not for another one', async () => {
    // Arrange
    const otherId = await createItem('https://other.example/article', { feedLink: 'https://other.example/feed', description: 'Other text' });
    await upsertArticleContent({ item_id: otherId, html: '<p>Other</p>', text: 'Other', word_count: 1, status: 'ok' });
    const itemId = await createItem('https://a.example/article', { description: 'Wanted text' });
    mockedFetchText.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: 'Wanted text', article: undefined });
    expect(mockedFetchText).toHaveBeenCalledWith('https://a.example/article', expect.anything());
  });

  test('takes the source type from the feed of the item', async () => {
    // Arrange
    await createItem('https://a.example/article', { feedLink: 'https://a.example/feed' });
    const videoId = await createItem('https://video.example/watch', { type: 'youtube', feedLink: 'https://video.example/feed', description: 'Video text' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, videoId);

    // Assert
    expect(result).toEqual({ description: 'Video text', article: undefined });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });

  test('stores a "too_short" row and leaves out an article that is too short', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/short');
    mockedFetchText.mockResolvedValue({ success: true, data: { body: '<p>Hi</p>', validators: { etag: undefined, last_modified: undefined } } });
    mockedExtractArticleInUtilityProcess.mockResolvedValue({ html: '<p>Hi</p>', text: 'Hi', wordCount: 1 });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result.article).toBeUndefined();
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('too_short');
  });

  test('stores a "failed" row and logs when the extraction throws', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/broken');
    const failure = new Error('worker crashed');
    const logged = vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    mockedFetchText.mockResolvedValue({ success: true, data: { body: '<p>x</p>', validators: { etag: undefined, last_modified: undefined } } });
    mockedExtractArticleInUtilityProcess.mockRejectedValue(failure);

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result.article).toBeUndefined();
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('failed');
    expect(logged).toHaveBeenCalledWith('operation.failure', { operation: 'extract-article', entityId: itemId }, failure);
  });
});

describe('handleFeedsListCategories', () => {
  test('lists the categories of the workspace asked for only', async () => {
    // Arrange
    const created = await createWorkspace('Other', 'Home01', '#ffffff');
    if (!created.success) {
      throw new Error('expected the workspace to be created');
    }
    await createCategory('Home only', HOME_WORKSPACE_ID);
    await createCategory('Other only', created.data.id);

    // Act
    const categories = await handleFeedsListCategories(fakeEvent, { workspaceId: created.data.id });

    // Assert
    expect(categories).toEqual([expect.objectContaining({ name: 'Other only', workspace_id: created.data.id })]);
  });
});

describe('handleFeedsSubmitAddFeed', () => {
  const sender = { id: 'renderer' };
  const event = { sender } as unknown as IpcMainInvokeEvent;

  function feedInput(type: SourceType, readAt: (number | undefined)[]) {
    return {
      link: `https://${type}.example/feed`,
      title: 'Feed',
      type,
      categoryName: 'tech',
      workspaceId: HOME_WORKSPACE_ID,
      showInWorkspace: true,
      items: readAt.map((value, index) => ({
        title: `Item ${index}`, link: `https://${type}.example/${index}`, guid: `${type}-${index}`, pubDate: '2024-01-01',
        description: '', image: undefined, author: undefined, extra: undefined,
        read_at: value === undefined ? undefined : new Date(value).toISOString(),
      })),
    };
  }

  test('counts every stored item and only the unread ones as unread', async () => {
    // Arrange
    const input = feedInput('rss', [undefined, 1_700_000_000_000, undefined]);

    // Act
    const result = await handleFeedsSubmitAddFeed(event, input);

    // Assert
    expect(result.success && { itemCount: result.data.itemCount, unreadCount: result.data.unreadCount }).toEqual({ itemCount: 3, unreadCount: 2 });
  });

  test('looks for the images of the new items of a source that fetches full articles', async () => {
    // Arrange
    const input = feedInput('rss', [undefined]);

    // Act
    const result = await handleFeedsSubmitAddFeed(event, input);

    // Assert
    expect(enrichItems).toHaveBeenCalledOnce();
    const [items] = vi.mocked(enrichItems).mock.calls[0] ?? [];
    expect(items).toEqual([expect.objectContaining({ link: 'https://rss.example/0' })]);
    expect(result.success).toBe(true);
  });

  test('stores a found image and tells the renderer', async () => {
    // Arrange
    const input = feedInput('rss', [undefined]);
    await handleFeedsSubmitAddFeed(event, input);
    const [items, onImageFound] = vi.mocked(enrichItems).mock.calls[0] ?? [];
    const item = items?.[0];
    if (!item || !onImageFound) {
      throw new Error('expected enrichItems to receive items and a callback');
    }
    const feed = await db.selectFrom('feedMetadata').select('id').where('link', '=', input.link).executeTakeFirstOrThrow();

    // Act
    onImageFound(item.id, 'https://rss.example/cover.png');

    // Assert
    await vi.waitFor(async () => {
      const stored = await db.selectFrom('feedItem').select('image').where('id', '=', item.id).executeTakeFirstOrThrow();
      expect(stored.image).toBe('https://rss.example/cover.png');
    });
    expect(sendToRenderer).toHaveBeenCalledExactlyOnceWith(sender, 'feeds:item-image-fetched', { feedId: feed.id, itemId: item.id, image: 'https://rss.example/cover.png' });
  });

  test('does not look for images for a source that does not fetch full articles', async () => {
    // Arrange
    const input = feedInput('youtube', [undefined]);

    // Act
    const result = await handleFeedsSubmitAddFeed(event, input);

    // Assert
    expect(result.success).toBe(true);
    expect(enrichItems).not.toHaveBeenCalled();
  });
});

describe('handleWorkspacesUpdate', () => {
  const nothingElse = { name: 'Reading', icon: 'Book01', color: '#112233' };

  test.each([
    ['name', { name: 'Renamed' }],
    ['icon', { icon: 'Star01' }],
    ['color', { color: '#abcdef' }],
  ] as const)('changes only the %s that the request holds', async (_field, change) => {
    // Arrange
    const created = await createWorkspace(nothingElse.name, nothingElse.icon, nothingElse.color);
    if (!created.success) {
      throw new Error('expected the workspace to be created');
    }

    // Act
    const result = await handleWorkspacesUpdate(fakeEvent, { workspaceId: created.data.id, ...change });

    // Assert
    expect(result).toEqual({ success: true, data: { ...created.data, ...change } });
    expect(vi.mocked(updateWorkspace).mock.calls[0]).toStrictEqual([created.data.id, change]);
  });

  test('changes all three fields when the request holds all three', async () => {
    // Arrange
    const created = await createWorkspace(nothingElse.name, nothingElse.icon, nothingElse.color);
    if (!created.success) {
      throw new Error('expected the workspace to be created');
    }
    const change = { name: 'Renamed', icon: 'Star01', color: '#abcdef' };

    // Act
    const result = await handleWorkspacesUpdate(fakeEvent, { workspaceId: created.data.id, ...change });

    // Assert
    expect(result).toEqual({ success: true, data: { ...created.data, ...change } });
  });
});

describe('handleSearchesUpdate', () => {
  test.each([
    ['name', { name: 'Renamed' }],
    ['query', { query: 'title:other' }],
  ] as const)('changes only the %s that the request holds', async (_field, change) => {
    // Arrange
    const created = await createSavedSearch(HOME_WORKSPACE_ID, 'Engineers', 'title:engineer');
    if (!created.success) {
      throw new Error('expected the saved search to be created');
    }

    // Act
    const result = await handleSearchesUpdate(fakeEvent, { searchId: created.data.id, ...change });

    // Assert
    expect(result).toEqual({ success: true, data: { ...created.data, ...change } });
    expect(vi.mocked(updateSavedSearch).mock.calls[0]).toStrictEqual([created.data.id, change]);
  });
});

describe('handleSettingsSetRefreshInterval', () => {
  test('stores the interval, reschedules the timer with it and returns it', async () => {
    // Act
    const result = await handleSettingsSetRefreshInterval(fakeEvent, 60);

    // Assert
    expect(result).toBe(60);
    expect(await getRefreshInterval()).toBe(60);
    expect(rescheduleRefresh).toHaveBeenCalledExactlyOnceWith(60);
  });

  test('turns an unsupported interval into the default before it stores and schedules it', async () => {
    // Act
    const result = await handleSettingsSetRefreshInterval(fakeEvent, 7 as never);

    // Assert
    expect(result).toBe(30);
    expect(rescheduleRefresh).toHaveBeenCalledExactlyOnceWith(30);
  });
});

describe('handleSettingsSetDetailedLogging', () => {
  test('stores the choice and applies it to the logger', async () => {
    // Act
    const result = await handleSettingsSetDetailedLogging(fakeEvent, true);

    // Assert
    expect(result).toBe(true);
    expect(await getDetailedLogging()).toBe(true);
    expect(applyDetailedLogging).toHaveBeenCalledExactlyOnceWith(true);
  });
});

describe('handleSettingsSetRetentionDays', () => {
  async function seedFeed(expiredCount: number) {
    const item = (name: string, ageDays: number, minute: number) => ({
      title: name, link: `https://a.example/${name}`, guid: name, pubDate: new Date(Date.now() - ageDays * DAY_MS - minute * 60_000).toISOString(),
      description: '', image: undefined, author: undefined, extra: undefined, read_at: undefined,
    });
    const recent = Array.from({ length: 10 }, (_, index) => item(`recent-${index}`, 1, index));
    const expired = Array.from({ length: expiredCount }, (_, index) => item(`expired-${index}`, 120, index));
    const result = await addFeedToDatabase({
      link: 'https://a.example/feed', title: 'Feed A', items: [...recent, ...expired], type: 'rss',
      categoryName: 'tech', workspaceId: HOME_WORKSPACE_ID, showInWorkspace: true,
    });
    if (!result.success) {
      throw new Error('expected the feed to be created');
    }
  }

  test('stores the days and returns them', async () => {
    // Arrange
    vi.mocked(refreshAllFeeds).mockResolvedValue({ perFeed: [] });

    // Act
    const result = await handleSettingsSetRetentionDays(fakeEvent, 60);

    // Assert
    expect(result).toBe(60);
    expect(await getRetentionDays()).toBe(60);
  });

  test('turns an unsupported number of days into the default', async () => {
    // Act
    const result = await handleSettingsSetRetentionDays(fakeEvent, 7 as never);

    // Assert
    expect(result).toBe(30);
    expect(await getRetentionDays()).toBe(30);
  });

  test('refreshes the feeds when the days grow and adds the removed items to the count', async () => {
    // Arrange
    await seedFeed(2);
    vi.mocked(refreshAllFeeds).mockResolvedValue({ perFeed: [{ feedId: 1, inserted: 4 }], removed: 3 });

    // Act
    await handleSettingsSetRetentionDays(fakeEvent, 90);

    // Assert
    expect(refreshAllFeeds).toHaveBeenCalledExactlyOnceWith(true);
    expect(broadcastToRenderers).toHaveBeenCalledExactlyOnceWith('feeds:refreshed', { perFeed: [{ feedId: 1, inserted: 4 }], removed: 5, applyImmediately: true });
  });

  test('counts the removed items when the refresh reports no removal', async () => {
    // Arrange
    await seedFeed(2);
    vi.mocked(refreshAllFeeds).mockResolvedValue({ perFeed: [] });

    // Act
    await handleSettingsSetRetentionDays(fakeEvent, 90);

    // Assert
    expect(broadcastToRenderers).toHaveBeenCalledExactlyOnceWith('feeds:refreshed', { perFeed: [], removed: 2, applyImmediately: true });
  });

  test('tells the renderer about the removed items without a refresh when the days shrink', async () => {
    // Arrange
    await setRetentionDays(90);
    await seedFeed(2);

    // Act
    await handleSettingsSetRetentionDays(fakeEvent, 30);

    // Assert
    expect(refreshAllFeeds).not.toHaveBeenCalled();
    expect(broadcastToRenderers).toHaveBeenCalledExactlyOnceWith('feeds:refreshed', { perFeed: [], removed: 2, applyImmediately: true });
  });

  test('removes expired items without a refresh when the days stay the same', async () => {
    // Arrange
    await setRetentionDays(30);
    await seedFeed(2);

    // Act
    await handleSettingsSetRetentionDays(fakeEvent, 30);

    // Assert
    expect(refreshAllFeeds).not.toHaveBeenCalled();
    expect(broadcastToRenderers).toHaveBeenCalledExactlyOnceWith('feeds:refreshed', { perFeed: [], removed: 2, applyImmediately: true });
  });

  test('stays quiet when the days shrink and nothing expires', async () => {
    // Arrange
    await setRetentionDays(90);
    await seedFeed(0);

    // Act
    await handleSettingsSetRetentionDays(fakeEvent, 30);

    // Assert
    expect(refreshAllFeeds).not.toHaveBeenCalled();
    expect(broadcastToRenderers).not.toHaveBeenCalled();
  });
});
