import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { fetchUrl } from './fetch';
import { MAX_FETCH_BYTES, MAX_REDIRECTS } from '../constants';

vi.mock(import('node:dns/promises'), () => ({ lookup: vi.fn() }));

// Pins the `all: true` overload, the only one the code under test uses.
const mockedLookup = vi.mocked(lookup as (hostname: string, options: { all: true }) => Promise<LookupAddress[]>);

function streamOf(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      chunks.forEach((chunk) => controller.enqueue(chunk));
      controller.close();
    },
  });
}

const PRIVATE_HOST_ERROR = { success: false, error: { name: 'BLOCKED_URL_ERROR', message: 'This address is not on the public internet.' } };
const SCHEME_ERROR = { success: false, error: { name: 'BLOCKED_URL_ERROR', message: 'Only http and https addresses can be fetched.' } };

describe('fetchUrl', () => {
  const mockedFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', mockedFetch);
  });

  afterEach(() => {
    mockedFetch.mockReset();
    mockedLookup.mockReset();
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

  test('returns NETWORK_ERROR for a string that is not a URL, without fetching', async () => {
    // Act
    const result = await fetchUrl('not a url');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: expect.any(String) } });
    expect(mockedFetch).not.toHaveBeenCalled();
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

  test('always passes a signal and manual redirects to fetch, even when the caller supplies none', async () => {
    // Arrange
    mockedFetch.mockResolvedValue(new Response('', { status: 200 }));

    // Act
    await fetchUrl('https://example.com');

    // Assert
    expect(mockedFetch).toHaveBeenCalledWith('https://example.com/', { signal: expect.any(AbortSignal), redirect: 'manual' });
  });

  test('refuses a non-http scheme without fetching', async () => {
    // Act
    const result = await fetchUrl('ftp://example.com/feed.xml');

    // Assert
    expect(result).toEqual(SCHEME_ERROR);
    expect(mockedFetch).not.toHaveBeenCalled();
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

  describe('redirects', () => {
    test('follows a redirect and returns the final body', async () => {
      // Arrange
      mockedFetch
        .mockResolvedValueOnce(Response.redirect('https://example.com/next', 302))
        .mockResolvedValueOnce(new Response('final', { status: 200 }));

      // Act
      const result = await fetchUrl('https://example.com/start');

      // Assert
      expect(result).toEqual({ success: true, data: 'final' });
      expect(mockedFetch).toHaveBeenCalledTimes(2);
      expect(mockedFetch).toHaveBeenLastCalledWith('https://example.com/next', expect.objectContaining({ redirect: 'manual' }));
    });

    test('resolves a relative location against the current url', async () => {
      // Arrange
      mockedFetch
        .mockResolvedValueOnce(new Response(null, { status: 301, headers: { location: '/moved' } }))
        .mockResolvedValueOnce(new Response('final', { status: 200 }));

      // Act
      await fetchUrl('https://example.com/a/start');

      // Assert
      expect(mockedFetch).toHaveBeenLastCalledWith('https://example.com/moved', expect.anything());
    });

    test('gives up after MAX_REDIRECTS hops', async () => {
      // Arrange
      mockedFetch.mockResolvedValue(Response.redirect('https://example.com/loop', 302));

      // Act
      const result = await fetchUrl('https://example.com/loop');

      // Assert
      expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'Too many redirects.' } });
      expect(mockedFetch).toHaveBeenCalledTimes(MAX_REDIRECTS + 1);
    });

    test('treats a redirect status with no location as a failed response', async () => {
      // Arrange
      mockedFetch.mockResolvedValue(new Response(null, { status: 302, statusText: 'Found' }));

      // Act
      const result = await fetchUrl('https://example.com');

      // Assert
      expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '302: Found' } });
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    test('refuses a redirect to a non-http scheme', async () => {
      // Arrange
      mockedFetch.mockResolvedValue(Response.redirect('file:///etc/passwd', 302));

      // Act
      const result = await fetchUrl('https://example.com');

      // Assert
      expect(result).toEqual(SCHEME_ERROR);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe('with blockPrivateHosts', () => {
    test.each([
      'http://127.0.0.1/',
      'http://10.0.0.1/',
      'http://169.254.1.1/',
      'http://192.168.1.1:8080/',
      'http://[::1]/',
      'http://[fe80::1]/',
      'http://2130706433/',
      'http://0x7f.1/',
    ])('refuses %s without fetching', async (url) => {
      // Act
      const result = await fetchUrl(url, { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual(PRIVATE_HOST_ERROR);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    test('fetches a public address', async () => {
      // Arrange
      mockedFetch.mockResolvedValue(new Response('ok', { status: 200 }));

      // Act
      const result = await fetchUrl('http://8.8.8.8/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: true, data: 'ok' });
    });

    test('refuses a name that resolves to a private address', async () => {
      // Arrange
      mockedLookup.mockResolvedValue([{ address: '192.168.0.10', family: 4 }]);

      // Act
      const result = await fetchUrl('https://intranet.example/feed', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual(PRIVATE_HOST_ERROR);
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    test('fetches a name that resolves to public addresses', async () => {
      // Arrange
      mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);
      mockedFetch.mockResolvedValue(new Response('ok', { status: 200 }));

      // Act
      const result = await fetchUrl('https://example.com/feed', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: true, data: 'ok' });
      expect(mockedLookup).toHaveBeenCalledWith('example.com', { all: true });
    });

    test('reports a name that does not resolve as a network error', async () => {
      // Arrange
      mockedLookup.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      // Act
      const result = await fetchUrl('https://missing.invalid/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'Could not resolve missing.invalid.' } });
      expect(mockedFetch).not.toHaveBeenCalled();
    });

    test('refuses a redirect from a public host to a private one', async () => {
      // Arrange
      mockedFetch.mockResolvedValue(Response.redirect('http://127.0.0.1/admin', 302));

      // Act
      const result = await fetchUrl('http://8.8.8.8/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual(PRIVATE_HOST_ERROR);
      expect(mockedFetch).toHaveBeenCalledTimes(1);
    });

    test('fetches a private address when the option is off', async () => {
      // Arrange
      mockedFetch.mockResolvedValue(new Response('local', { status: 200 }));

      // Act
      const result = await fetchUrl('http://127.0.0.1/');

      // Assert
      expect(result).toEqual({ success: true, data: 'local' });
      expect(mockedLookup).not.toHaveBeenCalled();
    });

    test('allowPrivateHosts lets a guarded fetch reach a private address', async () => {
      // Arrange: a fresh module instance, so the process-wide switch does not leak into other tests.
      vi.resetModules();
      const isolated = await import('./fetch');
      isolated.allowPrivateHosts();
      mockedFetch.mockResolvedValue(new Response('local', { status: 200 }));

      // Act
      const result = await isolated.fetchUrl('http://127.0.0.1/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: true, data: 'local' });
    });
  });
});

describe('fetchUrl against a real server', () => {
  let server: Server;
  let url: string;

  beforeAll(async () => {
    server = createServer((request, response) => {
      if (request.url === '/redirect') {
        response.writeHead(302, { location: '/final' });
        response.end();
        return;
      }
      if (request.url === '/final') {
        response.writeHead(200);
        response.end('final');
        return;
      }
      if (request.url === '/loop') {
        response.writeHead(302, { location: '/loop' });
        response.end();
        return;
      }
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

  test('follows a real redirect', async () => {
    // Act
    const result = await fetchUrl(`${url}/redirect`);

    // Assert
    expect(result).toEqual({ success: true, data: 'final' });
  });

  test('stops a real redirect loop', async () => {
    // Act
    const result = await fetchUrl(`${url}/loop`);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'Too many redirects.' } });
  });

  test('refuses the loopback server when private hosts are blocked', async () => {
    // Act
    const result = await fetchUrl(`${url}/final`, { blockPrivateHosts: true });

    // Assert
    expect(result).toEqual(PRIVATE_HOST_ERROR);
  });
});
