import { afterEach, describe, expect, test, vi } from 'vitest';
import { enrichItemImages, IMAGE_ENRICHMENT_CONCURRENCY } from './enrichItemImages';
import { fetchArticleImage } from './fetchArticleImage';
import type { FeedItem } from '../db/types';

vi.mock(import('./fetchArticleImage'), () => ({
  fetchArticleImage: vi.fn(),
}));

const mockedFetchArticleImage = vi.mocked(fetchArticleImage);

function item(overrides: Partial<Pick<FeedItem, 'id' | 'link' | 'image'>> = {}): Pick<FeedItem, 'id' | 'link' | 'image'> {
  return { id: 1, link: 'https://example.com/article', image: undefined, ...overrides };
}

afterEach(() => {
  mockedFetchArticleImage.mockReset();
});

describe('enrichItemImages', () => {
  test('fetches only items missing an image with an absolute http(s) link', async () => {
    // Arrange
    mockedFetchArticleImage.mockResolvedValue(undefined);
    const items = [item({ id: 1, link: 'https://example.com/1' }), item({ id: 2, link: 'http://example.com/2' })];

    // Act
    await enrichItemImages(items, vi.fn());

    // Assert
    expect(mockedFetchArticleImage).toHaveBeenCalledTimes(2);
    expect(mockedFetchArticleImage).toHaveBeenCalledWith('https://example.com/1');
    expect(mockedFetchArticleImage).toHaveBeenCalledWith('http://example.com/2');
  });

  test('skips an item that already has an image', async () => {
    // Arrange
    const items = [item({ id: 1, image: 'https://example.com/existing.jpg' })];

    // Act
    await enrichItemImages(items, vi.fn());

    // Assert
    expect(mockedFetchArticleImage).not.toHaveBeenCalled();
  });

  test('treats a null image (as read back from sqlite) as missing', async () => {
    // Arrange
    mockedFetchArticleImage.mockResolvedValue(undefined);
    // better-sqlite3 reads a NULL column back as `null`, not `undefined`, despite the FeedItem type.
    const items = [{ id: 1, link: 'https://example.com/1', image: null }] as unknown as Pick<FeedItem, 'id' | 'link' | 'image'>[];

    // Act
    await enrichItemImages(items, vi.fn());

    // Assert
    expect(mockedFetchArticleImage).toHaveBeenCalledWith('https://example.com/1');
  });

  test('skips an item with no link', async () => {
    // Arrange
    const items = [item({ id: 1, link: undefined })];

    // Act
    await enrichItemImages(items, vi.fn());

    // Assert
    expect(mockedFetchArticleImage).not.toHaveBeenCalled();
  });

  test('skips a non-http(s) link', async () => {
    // Arrange
    const items = [item({ id: 1, link: 'mailto:test@example.com' })];

    // Act
    await enrichItemImages(items, vi.fn());

    // Assert
    expect(mockedFetchArticleImage).not.toHaveBeenCalled();
  });

  test('invokes onImageFound for each successful fetch', async () => {
    // Arrange
    mockedFetchArticleImage.mockResolvedValue('https://example.com/found.jpg');
    const onImageFound = vi.fn();
    const items = [item({ id: 42, link: 'https://example.com/42' })];

    // Act
    await enrichItemImages(items, onImageFound);

    // Assert
    expect(onImageFound).toHaveBeenCalledWith(42, 'https://example.com/found.jpg');
  });

  test('does not invoke onImageFound when a fetch resolves undefined', async () => {
    // Arrange
    mockedFetchArticleImage.mockResolvedValue(undefined);
    const onImageFound = vi.fn();
    const items = [item({ id: 1, link: 'https://example.com/1' })];

    // Act
    await enrichItemImages(items, onImageFound);

    // Assert
    expect(onImageFound).not.toHaveBeenCalled();
  });

  test('resolves once every candidate has settled', async () => {
    // Arrange
    mockedFetchArticleImage.mockResolvedValue('https://example.com/found.jpg');
    const onImageFound = vi.fn();
    const items = [
      item({ id: 1, link: 'https://example.com/1' }),
      item({ id: 2, link: 'https://example.com/2' }),
      item({ id: 3, link: 'https://example.com/3' }),
    ];

    // Act
    await enrichItemImages(items, onImageFound);

    // Assert
    expect(onImageFound).toHaveBeenCalledTimes(3);
  });

  test('never runs more than IMAGE_ENRICHMENT_CONCURRENCY fetches at once', async () => {
    // Arrange
    let active = 0;
    let maxActive = 0;
    mockedFetchArticleImage.mockImplementation(() => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      return new Promise((resolve) => {
        queueMicrotask(() => {
          active -= 1;
          resolve(undefined);
        });
      });
    });
    const items = Array.from({ length: IMAGE_ENRICHMENT_CONCURRENCY * 3 }, (_, index) =>
      item({ id: index, link: `https://example.com/${index}` }));

    // Act
    await enrichItemImages(items, vi.fn());

    // Assert
    expect(maxActive).toBe(IMAGE_ENRICHMENT_CONCURRENCY);
  });

  test('resolves immediately, calling fetchArticleImage zero times, when there are no candidates', async () => {
    // Arrange
    const onImageFound = vi.fn();

    // Act
    await enrichItemImages([], onImageFound);

    // Assert
    expect(mockedFetchArticleImage).not.toHaveBeenCalled();
    expect(onImageFound).not.toHaveBeenCalled();
  });
});
