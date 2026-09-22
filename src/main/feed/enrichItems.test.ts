import { afterEach, describe, expect, test, vi } from 'vitest';
import { extractArticle } from './extractArticle';
import { extractOgImageUrl } from './extractOgImage';
import { enrichItems } from './enrichItems';
import { fetchUrl } from '../lib/fetch';
import type { FeedItem } from '../db/types';
import { ARTICLE_FETCH_TIMEOUT_MS, ENRICHMENT_CONCURRENCY } from '../constants';

vi.mock(import('../lib/fetch'), () => ({ fetchUrl: vi.fn() }));
vi.mock(import('./extractOgImage'), () => ({ extractOgImageUrl: vi.fn() }));
vi.mock(import('./extractArticle'), () => ({ extractArticle: vi.fn() }));

const mockedFetchUrl = vi.mocked(fetchUrl);
const mockedExtractOgImageUrl = vi.mocked(extractOgImageUrl);
const mockedExtractArticle = vi.mocked(extractArticle);

function item(overrides: Partial<Pick<FeedItem, 'id' | 'link' | 'image'>> = {}): Pick<FeedItem, 'id' | 'link' | 'image'> {
  return { id: 1, link: 'https://example.com/article', image: undefined, ...overrides };
}

afterEach(() => {
  mockedFetchUrl.mockReset();
  mockedExtractOgImageUrl.mockReset();
  mockedExtractArticle.mockReset();
});

describe('enrichItems', () => {
  test('fetches only items missing an image with an absolute http(s) link', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    mockedExtractOgImageUrl.mockReturnValue(undefined);
    const items = [item({ id: 1, link: 'https://example.com/1' }), item({ id: 2, link: 'http://example.com/2' })];

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
    expect(mockedFetchUrl).toHaveBeenCalledWith('https://example.com/1', { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true });
    expect(mockedFetchUrl).toHaveBeenCalledWith('http://example.com/2', { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true });
  });

  test('uses each fetched page only to find its image', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html>page</html>' });
    mockedExtractOgImageUrl.mockReturnValue('https://example.com/found.jpg');
    const onImageFound = vi.fn();
    const items = [item({ id: 1, link: 'https://example.com/1' })];

    // Act
    await enrichItems(items, onImageFound);

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(1);
    expect(mockedExtractOgImageUrl).toHaveBeenCalledWith('<html>page</html>');
    expect(mockedExtractArticle).not.toHaveBeenCalled();
    expect(onImageFound).toHaveBeenCalledWith(1, 'https://example.com/found.jpg');
  });

  test('does not fetch an item that already has an image', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    const items = [item({ id: 1, image: 'https://example.com/existing.jpg' })];

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(mockedFetchUrl).not.toHaveBeenCalled();
    expect(mockedExtractOgImageUrl).not.toHaveBeenCalled();
  });

  test('treats a null image (as read back from sqlite) as missing', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    mockedExtractOgImageUrl.mockReturnValue(undefined);
    // better-sqlite3 reads a NULL column back as `null`, not `undefined`, despite the FeedItem type.
    const items = [{ id: 1, link: 'https://example.com/1', image: null }] as unknown as Pick<FeedItem, 'id' | 'link' | 'image'>[];

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(mockedExtractOgImageUrl).toHaveBeenCalledWith('<html></html>');
  });

  test('skips an item with no link', async () => {
    // Arrange
    const items = [item({ id: 1, link: undefined })];

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('skips a non-http(s) link', async () => {
    // Arrange
    const items = [item({ id: 1, link: 'mailto:test@example.com' })];

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(mockedFetchUrl).not.toHaveBeenCalled();
  });

  test('a fetch failure does not stop the other items', async () => {
    // Arrange
    mockedFetchUrl.mockImplementation((link) => Promise.resolve(
      link === 'https://example.com/1'
        ? { success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } }
        : { success: true, data: '<html></html>' },
    ));
    const onImageFound = vi.fn();
    const items = [item({ id: 1, link: 'https://example.com/1' }), item({ id: 2, link: 'https://example.com/2' })];

    // Act
    await enrichItems(items, onImageFound);

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(2);
  });

  test('resolves once every candidate has settled', async () => {
    // Arrange
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html></html>' });
    const items = [
      item({ id: 1, link: 'https://example.com/1' }),
      item({ id: 2, link: 'https://example.com/2' }),
      item({ id: 3, link: 'https://example.com/3' }),
    ];

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(mockedFetchUrl).toHaveBeenCalledTimes(3);
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
    const items = Array.from({ length: ENRICHMENT_CONCURRENCY * 3 }, (_, index) =>
      item({ id: index, link: `https://${index}.example.com/article` }));

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(maxActive).toBe(ENRICHMENT_CONCURRENCY);
  });

  test('runs only one fetch at a time for the same host', async () => {
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
    const items = Array.from({ length: ENRICHMENT_CONCURRENCY }, (_, index) =>
      item({ id: index, link: `https://example.com/article-${index}` }));

    // Act
    await enrichItems(items, vi.fn());

    // Assert
    expect(maxActive).toBe(1);
  });

  test('resolves immediately, calling neither extractor, when there are no candidates', async () => {
    // Act
    await enrichItems([], vi.fn());

    // Assert
    expect(mockedFetchUrl).not.toHaveBeenCalled();
    expect(mockedExtractOgImageUrl).not.toHaveBeenCalled();
    expect(mockedExtractArticle).not.toHaveBeenCalled();
  });
});
