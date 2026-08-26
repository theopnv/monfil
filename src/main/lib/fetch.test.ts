import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { fetchUrl } from './fetch';
import { MAX_FETCH_BYTES } from '../constants';

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

describe('fetchUrl', () => {
  const mockedFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockedFetch);
  });

  afterEach(() => {
    mockedFetch.mockReset();
    vi.unstubAllGlobals();
  });

  test('returns the response body on success', async () => {
    // Arrange
    mockedFetch.mockResolvedValue(new Response('<html></html>', { status: 200 }));

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: true, data: '<html></html>' });
  });

  test('returns GENERIC_FETCH_ERROR when the response is not ok', async () => {
    // Arrange
    mockedFetch.mockResolvedValue(new Response('', { status: 404, statusText: 'Not Found' }));

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '404: Not Found' } });
  });

  test('returns NETWORK_ERROR when fetch throws a TypeError', async () => {
    // Arrange
    mockedFetch.mockRejectedValue(new TypeError('Failed to fetch'));

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'Failed to fetch' } });
  });

  test('returns NOT_ALLOWED_OR_ABORTED_ERROR when fetch throws an AbortError', async () => {
    // Arrange
    mockedFetch.mockRejectedValue(new DOMException('The operation was aborted', 'AbortError'));

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'Request was aborted or not allowed' } });
  });

  test('returns a timeout-specific message when fetch throws a TimeoutError', async () => {
    // Arrange
    mockedFetch.mockRejectedValue(new DOMException('The operation timed out', 'TimeoutError'));

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'The server took too long to answer.' } });
  });

  test('aborting the caller-supplied signal aborts the signal given to fetch', async () => {
    // Arrange
    mockedFetch.mockResolvedValue(new Response('', { status: 200 }));
    const controller = new AbortController();

    // Act
    await fetchUrl('https://example.com', { signal: controller.signal });
    const receivedSignal = mockedFetch.mock.calls[0]?.[1]?.signal as AbortSignal;
    controller.abort();

    // Assert
    expect(receivedSignal.aborted).toBe(true);
  });

  test('always passes a signal to fetch, even when the caller supplies none', async () => {
    // Arrange
    mockedFetch.mockResolvedValue(new Response('', { status: 200 }));

    // Act
    await fetchUrl('https://example.com');

    // Assert
    expect(mockedFetch).toHaveBeenCalledWith('https://example.com', { signal: expect.any(AbortSignal) });
  });

  test('rejects a streamed body past the cap', async () => {
    // Arrange
    const chunk = new Uint8Array(MAX_FETCH_BYTES + 1);
    mockedFetch.mockResolvedValue(new Response(streamOf([chunk]), { status: 200 }));

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } });
  });

  test('rejects on a content-length over the cap without reading the body', async () => {
    // Arrange
    const response = new Response('ignored', { status: 200, headers: { 'content-length': String(MAX_FETCH_BYTES + 1) } });
    if (!response.body) {
      throw new Error('expected a body stream');
    }
    const getReader = vi.spyOn(response.body, 'getReader');
    mockedFetch.mockResolvedValue(response);

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } });
    expect(getReader).not.toHaveBeenCalled();
  });

  test('returns a body just under the cap intact', async () => {
    // Arrange
    const body = 'a'.repeat(MAX_FETCH_BYTES - 1);
    mockedFetch.mockResolvedValue(new Response(body, { status: 200 }));

    // Act
    const result = await fetchUrl('https://example.com');

    // Assert
    expect(result).toEqual({ success: true, data: body });
  });
});

describe('fetchUrl against a real server', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((_request, response) => {
      response.writeHead(200);
      // Never call response.end(): simulates a server that accepts the connection and stays silent.
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  test('times out on a server that never answers', async () => {
    // Act
    const result = await fetchUrl(url, { timeoutMs: 20 });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'The server took too long to answer.' } });
  });

  test('returns immediately for a caller-supplied signal that is already aborted', async () => {
    // Arrange
    const controller = new AbortController();
    controller.abort();

    // Act
    const result = await fetchUrl(url, { signal: controller.signal, timeoutMs: 5000 });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'Request was aborted or not allowed' } });
  });
});
