import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../database';
import { addFeedToDatabase, upsertArticleContent } from '../db/insert';
import { fetchUrl } from '../fetch';
import { handleItemsGetContent } from './handlers';
import type { IpcMainInvokeEvent } from 'electron';

vi.mock(import('../fetch'), () => ({ fetchUrl: vi.fn() }));

const mockedFetchUrl = vi.mocked(fetchUrl);
const fakeEvent = {} as IpcMainInvokeEvent;

const PARAGRAPH = 'This is a long paragraph about something interesting that readers care about deeply. '.repeat(6);
const ARTICLE_PAGE_HTML = `<!doctype html>
<html><head><title>An Article</title></head>
<body><article><h1>An Article</h1>
<p>${PARAGRAPH}</p>
<p>Another paragraph continues the story with more detail and context for the reader to enjoy.</p>
</article></body></html>`;

async function createItem(link: string | undefined): Promise<number> {
  const result = await addFeedToDatabase({
    link: 'https://a.example/feed',
    title: 'Feed A',
    items: [{ title: 'Item', link, pubDate: '2024-01-01', description: '', image: undefined, read_at: undefined }],
    categoryName: 'tech',
    showInHome: true,
  });
  if (!result.success) throw new Error('expected the feed to be created');
  const itemId = result.data.items[0]?.id;
  if (itemId === undefined) throw new Error('expected an item id');
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
    expect(result).toEqual({ status: 'ok', html: '<p>Stored</p>', wordCount: 1 });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('returns "unavailable" for a stored "failed" row without fetching again', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    await upsertArticleContent({ item_id: itemId, html: undefined, text: undefined, word_count: undefined, status: 'failed' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ status: 'unavailable' });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('returns "unavailable" for a stored "too_short" row without fetching again', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    await upsertArticleContent({ item_id: itemId, html: '<p>x</p>', text: 'x', word_count: 1, status: 'too_short' });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ status: 'unavailable' });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('a missing row fetches, extracts, stores and returns the article', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/long-article');
    mockedFetchUrl.mockResolvedValue({ success: true, data: ARTICLE_PAGE_HTML });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledWith('https://a.example/long-article', expect.any(AbortSignal));
    expect(result.status).toBe('ok');
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('ok');
    expect(stored.html).toContain('<p>');
  });

  test('a fetch failure stores a "failed" row and returns "unavailable"', async () => {
    // Arrange
    const itemId = await createItem('https://a.example/article');
    mockedFetchUrl.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ status: 'unavailable' });
    const stored = await db.selectFrom('articleContent').selectAll().where('item_id', '=', itemId).executeTakeFirstOrThrow();
    expect(stored.status).toBe('failed');
  });

  test('an item with no link returns "unavailable" without fetching', async () => {
    // Arrange
    const itemId = await createItem(undefined);

    // Act
    const result = await handleItemsGetContent(fakeEvent, itemId);

    // Assert
    expect(result).toEqual({ status: 'unavailable' });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('an unknown item id returns "unavailable" without fetching', async () => {
    // Act
    const result = await handleItemsGetContent(fakeEvent, 999999);

    // Assert
    expect(result).toEqual({ status: 'unavailable' });
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });
});
