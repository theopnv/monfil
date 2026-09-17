import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { addFeedToDatabase, upsertArticleContent } from '../db/crud/insert';
import { fetchUrl } from '../lib/fetch';
import { handleItemsGetContent } from './handlers';
import { ARTICLE_FETCH_TIMEOUT_MS } from '../constants';
import type { IpcMainInvokeEvent } from 'electron';
import { HOME_WORKSPACE_ID, type SourceType } from '../db/types';

vi.mock(import('../lib/fetch'), () => ({ fetchUrl: vi.fn() }));

const mockedFetchUrl = vi.mocked(fetchUrl);
const fakeEvent = {} as IpcMainInvokeEvent;

const PARAGRAPH = 'This is a long paragraph about something interesting that readers care about deeply. '.repeat(6);
const ARTICLE_PAGE_HTML = `<!doctype html>
<html><head><title>An Article</title></head>
<body><article><h1>An Article</h1>
<p>${PARAGRAPH}</p>
<p>Another paragraph continues the story with more detail and context for the reader to enjoy.</p>
</article></body></html>`;

async function createItem(link: string | undefined, options: { type?: SourceType; description?: string } = {}): Promise<number> {
  const result = await addFeedToDatabase({
    link: 'https://a.example/feed',
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
  mockedFetchUrl.mockReset();
  await db.deleteFrom('articleContent').execute();
  await db.deleteFrom('feedItem').execute();
  await db.deleteFrom('feedMetadata').execute();
  await db.deleteFrom('feedCategory').execute();
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
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('leaves out the article for a stored "failed" row without fetching again', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    await upsertArticleContent({ item_id: itemId, html: undefined, text: undefined, word_count: undefined, status: 'failed' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('leaves out the article for a stored "too_short" row without fetching again', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    await upsertArticleContent({ item_id: itemId, html: '<p>x</p>', text: 'x', word_count: 1, status: 'too_short' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('a missing row fetches, extracts, stores and returns the article', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/long-article');
    mockedFetchUrl.mockResolvedValue({ success: true, data: ARTICLE_PAGE_HTML });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledWith('https://a.example/long-article', { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS });
    expect(result.article?.html).toContain('<p>');
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('ok');
    expect(stored.html).toContain('<p>');
  });

  test('a fetch failure stores a "failed" row and leaves out the article', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    mockedFetchUrl.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('failed');
  });

  test('an item with no link returns its description without fetching', async () => {
    // Arrange
    const itemId = await createItem(undefined, { description: 'Fallback text' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: 'Fallback text', article: undefined });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('an unknown item id returns an empty body without fetching', async () => {
    // Act
    const result = await handleItemsGetContent(fakeEvent, 999999);

    // Assert
    expect(result).toEqual({ description: '', article: undefined });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('a source that does not fetch full articles skips extraction entirely', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/video', { type: 'youtube', description: 'Video description' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ description: 'Video description', article: undefined });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });
});
