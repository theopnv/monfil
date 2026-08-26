import { afterEach, describe, expect, test, vi } from 'vitest';
import { deriveArticleContentStatus, extractArticle } from './extractArticle';
import { extractOgImageUrl } from './extractOgImage';
import { enrichItems } from './enrichItems';
import { fetchUrl } from '../lib/fetch';
import type { FeedItem } from '../db/types';
import { ARTICLE_FETCH_TIMEOUT_MS, ENRICHMENT_CONCURRENCY } from '../constants';

vi.mock(import('../lib/fetch'), () => ({ fetchUrl: vi.fn() }));
vi.mock(import('./extractOgImage'), () => ({ extractOgImageUrl: vi.fn() }));
vi.mock(import('./extractArticle'), () => ({ extractArticle: vi.fn(), deriveArticleContentStatus: vi.fn() }));

const mockedFetchUrl = vi.mocked(fetchUrl);
const mockedExtractOgImageUrl = vi.mocked(extractOgImageUrl);
const mockedExtractArticle = vi.mocked(extractArticle);
const mockedDeriveArticleContentStatus = vi.mocked(deriveArticleContentStatus);

function item(overrides: Partial<Pick<FeedItem, 'id' | 'link' | 'image'>> = {}): Pick<FeedItem, 'id' | 'link' | 'image'> {
  return { id: 1, link: 'https://example.com/article', image: undefined, ...overrides };
}

afterEach(() => {
  mockedFetchUrl.mockReset();
  mockedExtractOgImageUrl.mockReset();
  mockedExtractArticle.mockReset();
  mockedDeriveArticleContentStatus.mockReset();
});

describe('enrichItems', () => {
  test('fetches only items missing an image with an absolute http(s) link', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    mockedExtractOgImageUrl.mockReturnValue(undefined);
    mockedExtractArticle.mockReturnValue(undefined);
    mockedDeriveArticleContentStatus.mockReturnValue('failed');
    const items = [item({ id: 1, link: 'https://example.com/1' }), item({ id: 2, link: 'http://example.com/2' })];

    // Act
    await enrichItems(items, vi.fn(), vi.fn());

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
    expect(mockedFetchUrl).toHaveBeenCalledWith('https://example.com/1', { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS });
    expect(mockedFetchUrl).toHaveBeenCalledWith('http://example.com/2', { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS });
  });

  test('one fetch feeds both the image and the content extractor', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html>page</html>' });
    mockedExtractOgImageUrl.mockReturnValue('https://example.com/found.jpg');
    mockedExtractArticle.mockReturnValue({ html: '<p>body</p>', text: 'body', wordCount: 1 });
    mockedDeriveArticleContentStatus.mockReturnValue('ok');
    const onImageFound = vi.fn();
    const onContentFound = vi.fn();
    const items = [item({ id: 1, link: 'https://example.com/1' })];

    // Act
    await enrichItems(items, onImageFound, onContentFound);

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(1);
    expect(mockedExtractOgImageUrl).toHaveBeenCalledWith('<html>page</html>');
    expect(mockedExtractArticle).toHaveBeenCalledWith('<html>page</html>', 'https://example.com/1');
    expect(onImageFound).toHaveBeenCalledWith(1, 'https://example.com/found.jpg');
    expect(onContentFound).toHaveBeenCalledWith(1, { html: '<p>body</p>', text: 'body', word_count: 1, status: 'ok' });
  });

  test('an item that already has an image is still fetched for its content', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    mockedExtractArticle.mockReturnValue({ html: '<p>body</p>', text: 'body', wordCount: 1 });
    mockedDeriveArticleContentStatus.mockReturnValue('ok');
    const onContentFound = vi.fn();
    const items = [item({ id: 1, image: 'https://example.com/existing.jpg' })];

    // Act
    await enrichItems(items, vi.fn(), onContentFound);

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(1);
    expect(mockedExtractOgImageUrl).not.toHaveBeenCalled();
    expect(onContentFound).toHaveBeenCalledWith(1, expect.objectContaining({ status: 'ok' }));
  });

  test('treats a null image (as read back from sqlite) as missing', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    mockedExtractOgImageUrl.mockReturnValue(undefined);
    mockedExtractArticle.mockReturnValue(undefined);
    mockedDeriveArticleContentStatus.mockReturnValue('failed');
    // better-sqlite3 reads a NULL column back as `null`, not `undefined`, despite the FeedItem type.
    const items = [{ id: 1, link: 'https://example.com/1', image: null }] as unknown as Pick<FeedItem, 'id' | 'link' | 'image'>[];

    // Act
    await enrichItems(items, vi.fn(), vi.fn());

    // Assert
    expect(mockedExtractOgImageUrl).toHaveBeenCalledWith('<html></html>');
  });

  test('skips an item with no link', async () => {
    // Arrange
    const items = [item({ id: 1, link: undefined })];

    // Act
    await enrichItems(items, vi.fn(), vi.fn());

    // Assert
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('skips a non-http(s) link', async () => {
    // Arrange
    const items = [item({ id: 1, link: 'mailto:test@example.com' })];

    // Act
    await enrichItems(items, vi.fn(), vi.fn());

    // Assert
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('a fetch failure does not stop the other items, and reports neither image nor content', async () => {
    // Arrange
    mockedFetchUrl.mockImplementation((link) => Promise.resolve(
      link === 'https://example.com/1'
        ? { success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } }
        : { success: true, data: '<html></html>' },
    ));
    mockedExtractArticle.mockReturnValue({ html: '<p>body</p>', text: 'body', wordCount: 1 });
    mockedDeriveArticleContentStatus.mockReturnValue('ok');
    const onImageFound = vi.fn();
    const onContentFound = vi.fn();
    const items = [item({ id: 1, link: 'https://example.com/1' }), item({ id: 2, link: 'https://example.com/2' })];

    // Act
    await enrichItems(items, onImageFound, onContentFound);

    // Assert
    expect(onContentFound).toHaveBeenCalledTimes(1);
    expect(onContentFound).toHaveBeenCalledWith(2, expect.anything());
  });

  test('resolves once every candidate has settled', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    mockedExtractArticle.mockReturnValue(undefined);
    mockedDeriveArticleContentStatus.mockReturnValue('failed');
    const onContentFound = vi.fn();
    const items = [
      item({ id: 1, link: 'https://example.com/1' }),
      item({ id: 2, link: 'https://example.com/2' }),
      item({ id: 3, link: 'https://example.com/3' }),
    ];

    // Act
    await enrichItems(items, vi.fn(), onContentFound);

    // Assert
    expect(onContentFound).toHaveBeenCalledTimes(3);
  });

  test('never runs more than ENRICHMENT_CONCURRENCY fetches at once', async () => {
    // Arrange
    let active = 0;
    let maxActive = 0;
    mockedFetchUrl.mockImplementation(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        queueMicrotask(() => {
          active -= 1;
          resolve({ success: true, data: '<html></html>' });
        });
      });
    });
    mockedExtractArticle.mockReturnValue(undefined);
    mockedDeriveArticleContentStatus.mockReturnValue('failed');
    const items = Array.from({ length: ENRICHMENT_CONCURRENCY * 3 }, (_, index) =>
      item({ id: index, link: `https://example.com/${index}` }));

    // Act
    await enrichItems(items, vi.fn(), vi.fn());

    // Assert
    expect(maxActive).toBe(ENRICHMENT_CONCURRENCY);
  });

  test('resolves immediately, calling neither extractor, when there are no candidates', async () => {
    // Act
    await enrichItems([], vi.fn(), vi.fn());

    // Assert
    expect(mockedFetchUrl).not.toHaveBeenCalled();
    expect(mockedExtractOgImageUrl).not.toHaveBeenCalled();
    expect(mockedExtractArticle).not.toHaveBeenCalled();
  });
});
