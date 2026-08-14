import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchUrl } from './fetch';

const mockedFetch = vi.fn();
vi.stubGlobal('fetch', mockedFetch);

afterEach(() => {
  mockedFetch.mockReset();
});

describe('fetchUrl', () => {
  test('returns the response body on success', async () => {
    mockedFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('<html></html>') });

    const result = await fetchUrl('https://example.com');

    expect(result).toEqual({ success: true, data: '<html></html>' });
  });

  test('returns GENERIC_FETCH_ERROR when the response is not ok', async () => {
    mockedFetch.mockResolvedValue({ ok: false, status: 404, statusText: 'Not Found' });

    const result = await fetchUrl('https://example.com');

    expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '404: Not Found' } });
  });

  test('returns NETWORK_ERROR when fetch throws a TypeError', async () => {
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    const result = await fetchUrl('https://example.com');

    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'Failed to fetch' } });
  });

  test('returns NOT_ALLOWED_OR_ABORTED_ERROR when fetch throws an AbortError', async () => {
    mockedFetch.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    const result = await fetchUrl('https://example.com');

    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'Request was aborted or not allowed' } });
  });

  test('returns NOT_ALLOWED_OR_ABORTED_ERROR when fetch throws a TimeoutError', async () => {
    mockedFetch.mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));

    const result = await fetchUrl('https://example.com');

    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'Request was aborted or not allowed' } });
  });

  test('forwards the given signal to the underlying fetch call', async () => {
    mockedFetch.mockResolvedValue({ ok: true, text: () => Promise.resolve('') });
    const controller = new AbortController();

    await fetchUrl('https://example.com', controller.signal);

    expect(mockedFetch).toHaveBeenCalledWith('https://example.com', { signal: controller.signal });
  });
});
