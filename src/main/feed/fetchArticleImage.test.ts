import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchArticleImage } from './fetchArticleImage';
import { fetchUrl } from '../fetch';

vi.mock(import('../fetch'), () => ({
  fetchUrl: vi.fn(),
}));

const mockedFetchUrl = vi.mocked(fetchUrl);

afterEach(() => {
  mockedFetchUrl.mockReset();
});

describe('fetchArticleImage', () => {
  test('returns the extracted image on success', async () => {
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<meta property="og:image" content="https://example.com/a.jpg">' });

    const result = await fetchArticleImage('https://example.com/article');

    expect(result).toBe('https://example.com/a.jpg');
  });

  test('returns undefined when fetchUrl fails', async () => {
    mockedFetchUrl.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'boom' } });

    const result = await fetchArticleImage('https://example.com/article');

    expect(result).toBeUndefined();
  });

  test('returns undefined when the html has no og or twitter image', async () => {
    mockedFetchUrl.mockResolvedValue({ success: true, data: '<html><head><title>No image</title></head></html>' });

    const result = await fetchArticleImage('https://example.com/article');

    expect(result).toBeUndefined();
  });

  test('passes an AbortSignal as the second argument to fetchUrl', async () => {
    mockedFetchUrl.mockResolvedValue({ success: true, data: '' });

    await fetchArticleImage('https://example.com/article');

    expect(mockedFetchUrl).toHaveBeenCalledWith('https://example.com/article', expect.any(AbortSignal));
  });
});
