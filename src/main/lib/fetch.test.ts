import { afterAll, afterEach, beforeAll, describe, expect, test, vi } from 'vitest';
import { createServer, type RequestListener, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { lookup } from 'node:dns/promises';
import type { LookupAddress } from 'node:dns';
import { fetchConditional, fetchText, setRequestTransport, type RequestTransport } from './fetch';
import { MAX_FETCH_BYTES, MAX_REDIRECTS } from '../constants';

vi.mock(import('node:dns/promises'), () => ({ lookup: vi.fn() }));

vi.mock(import('electron'), () => ({
  app: { getVersion: () => '1.2.3' },
  net: {},
}) as unknown as Partial<typeof import('electron')>);

// Pins the `all: true` overload, the only one the code under test uses.
const mockedLookup = vi.mocked(lookup as (hostname: string, options: { all: true }) => Promise<LookupAddress[]>);

const PRIVATE_HOST_ERROR = { success: false, error: { name: 'BLOCKED_URL_ERROR', message: 'This address is not on the public internet.' } };
const SCHEME_ERROR = { success: false, error: { name: 'BLOCKED_URL_ERROR', message: 'Only http and https addresses can be fetched.' } };

interface RecordedRequest {
  url: string;
  headers: Record<string, string | string[] | undefined>;
}

interface StubResponse {
  status: number;
  statusMessage?: string;
  headers?: Record<string, string>;
  body?: string | ReadableStream<Uint8Array>;
  /** When set, the transport stops here and reports this as the next hop instead of a response. */
  redirectTo?: string;
}

/**
 * A transport driven by a per-URL response table, standing in for Electron's Chromium stack in the
 * unit suite. Every request is recorded, so tests assert on the exact headers the fetch sent.
 */
function stubTransport(responses: (url: string) => StubResponse | undefined): { transport: RequestTransport; requests: RecordedRequest[] } {
  const requests: RecordedRequest[] = [];
  const transport: RequestTransport = async (target, headers) => {
    requests.push({ url: target.href, headers });
    const response = responses(target.href);
    if (!response) {
      throw Object.assign(new Error(`net::ERR_NO_MATCHING_STUB for ${target.href}`), { name: 'Error' });
    }
    if (response.redirectTo !== undefined) {
      return { status: response.status, statusMessage: '', headers: {}, redirectUrl: response.redirectTo, abort: () => undefined };
    }
    const body = response.body ?? '';
    const stream = typeof body === 'string'
      ? new ReadableStream<Uint8Array>({
        start(controller) {
          const encoded = new TextEncoder().encode(body);
          controller.enqueue(encoded);
          controller.close();
        },
      })
      : body;
    return {
      status: response.status,
      statusMessage: response.statusMessage ?? '',
      headers: response.headers ?? {},
      readBody: async () => {
        // Mirrors the real transport: a declared length over the cap is refused before reading.
        const declared = (response.headers ?? {})['Content-Length'];
        if (declared && Number(declared) > MAX_FETCH_BYTES) {
          return { success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } };
        }
        const reader = stream.getReader();
        const decoder = new TextDecoder();
        let text = '';
        let bytesRead = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) {
            return { success: true, data: text };
          }
          bytesRead += value.byteLength;
          if (bytesRead > MAX_FETCH_BYTES) {
            return { success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } };
          }
          text += decoder.decode(value, { stream: true });
        }
      },
      abort: () => undefined,
    };
  };
  return { transport, requests };
}

function useTransport(responses: (url: string) => StubResponse | undefined): RecordedRequest[] {
  const { transport, requests } = stubTransport(responses);
  setRequestTransport(transport);
  return requests;
}

describe('fetchText', () => {
  afterEach(() => {
    setRequestTransport(undefined as unknown as RequestTransport);
    mockedLookup.mockReset();
  });

  test('returns the response body on success', async () => {
    // Arrange
    useTransport(() => ({ status: 200, body: '<html></html>' }));

    // Act
    const result = await fetchText('https://example.com');

    // Assert
    expect(result).toEqual({ success: true, data: { body: '<html></html>', validators: { etag: undefined, last_modified: undefined } } });
  });

  test('sends the monfil user agent and a no-cache directive', async () => {
    // Arrange
    const requests = useTransport(() => ({ status: 200, body: '' }));

    // Act
    await fetchText('https://example.com');

    // Assert
    expect(requests[0]?.headers['User-Agent']).toMatch(/^monfil\/\d+\.\d+\.\d+ \(\+https:\/\/github\.com\/theopnv\/monfil\)$/);
    expect(requests[0]?.headers['Cache-Control']).toBe('no-cache');
  });

  test('returns GENERIC_FETCH_ERROR when the response is not ok', async () => {
    // Arrange
    useTransport(() => ({ status: 404, statusMessage: 'Not Found' }));

    // Act
    const result = await fetchText('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '404: Not Found' } });
  });

  test('returns NETWORK_ERROR when the transport throws a Chromium network error', async () => {
    // Arrange
    useTransport(() => {
      throw new Error('net::ERR_NAME_NOT_RESOLVED');
    });

    // Act
    const result = await fetchText('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'net::ERR_NAME_NOT_RESOLVED' } });
  });

  test('returns NETWORK_ERROR for a string that is not a URL, without fetching', async () => {
    // Arrange
    const requests = useTransport(() => ({ status: 200, body: '' }));

    // Act
    const result = await fetchText('not a url');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: expect.any(String) } });
    expect(requests).toHaveLength(0);
  });

  test('returns NOT_ALLOWED_OR_ABORTED_ERROR when the caller-supplied signal is already aborted', async () => {
    // Arrange
    const requests = useTransport(() => ({ status: 200, body: '' }));
    const controller = new AbortController();
    controller.abort();

    // Act
    const result = await fetchText('https://example.com', { signal: controller.signal });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'Request was aborted or not allowed' } });
    expect(requests).toHaveLength(0);
  });

  test('refuses a non-http scheme without fetching', async () => {
    // Arrange
    const requests = useTransport(() => ({ status: 200, body: '' }));

    // Act
    const result = await fetchText('ftp://example.com/feed.xml');

    // Assert
    expect(result).toEqual(SCHEME_ERROR);
    expect(requests).toHaveLength(0);
  });

  test('rejects a streamed body past the cap', async () => {
    // Arrange
    const chunk = new Uint8Array(MAX_FETCH_BYTES + 1);
    useTransport(() => ({ status: 200, body: new ReadableStream<Uint8Array>({ start: (controller) => controller.enqueue(chunk) }) }));

    // Act
    const result = await fetchText('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } });
  });

  test('rejects on a content-length over the cap without reading the body', async () => {
    // Arrange
    const requests = useTransport(() => ({ status: 200, headers: { 'Content-Length': String(MAX_FETCH_BYTES + 1) }, body: '' }));

    // Act
    const result = await fetchText('https://example.com');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } });
    expect(requests).toHaveLength(1);
  });

  test('returns a body just under the cap intact', async () => {
    // Arrange
    const body = 'a'.repeat(MAX_FETCH_BYTES - 1);
    useTransport(() => ({ status: 200, body }));

    // Act
    const result = await fetchText('https://example.com');

    // Assert
    expect(result).toEqual({ success: true, data: { body, validators: { etag: undefined, last_modified: undefined } } });
  });

  test('aborts the response request when the timeout fires during body reading', async () => {
    // Arrange
    const abort = vi.fn();
    setRequestTransport(async () => ({
      status: 200,
      statusMessage: 'OK',
      headers: {},
      readBody: () => new Promise<never>(() => undefined),
      abort,
    }));

    // Act
    const result = await fetchText('https://example.com', { timeoutMs: 10 });

    // Assert
    expect(result).toEqual({
      success: false,
      error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'The server took too long to answer.' },
    });
    expect(abort).toHaveBeenCalledTimes(1);
  });

  test('captures the etag and last-modified the response sent', async () => {
    // Arrange
    useTransport(() => ({ status: 200, body: 'feed', headers: { ETag: '"v1"', 'Last-Modified': 'Tue, 15 Nov 1994 12:45:26 GMT' } }));

    // Act
    const result = await fetchText('https://example.com');

    // Assert
    expect(result).toEqual({
      success: true,
      data: { body: 'feed', validators: { etag: '"v1"', last_modified: 'Tue, 15 Nov 1994 12:45:26 GMT' } },
    });
  });

  describe('redirects', () => {
    test('follows a redirect and returns the final body', async () => {
      // Arrange
      const requests = useTransport((url) => (
        url === 'https://example.com/start'
          ? { status: 302, redirectTo: '/next' }
          : { status: 200, body: 'final' }
      ));

      // Act
      const result = await fetchText('https://example.com/start');

      // Assert
      expect(result).toEqual({ success: true, data: { body: 'final', validators: { etag: undefined, last_modified: undefined } } });
      expect(requests.map((request) => request.url)).toEqual(['https://example.com/start', 'https://example.com/next']);
    });

    test('resolves a relative location against the current url', async () => {
      // Arrange
      const requests = useTransport((url) => (
        url === 'https://example.com/a/start'
          ? { status: 301, redirectTo: '/moved' }
          : { status: 200, body: 'final' }
      ));

      // Act
      await fetchText('https://example.com/a/start');

      // Assert
      expect(requests.map((request) => request.url)).toEqual(['https://example.com/a/start', 'https://example.com/moved']);
    });

    test('gives up after MAX_REDIRECTS hops', async () => {
      // Arrange
      const requests = useTransport(() => ({ status: 302, redirectTo: '/loop' }));

      // Act
      const result = await fetchText('https://example.com/loop');

      // Assert
      expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'Too many redirects.' } });
      expect(requests).toHaveLength(MAX_REDIRECTS + 1);
    });

    test('refuses a redirect to a non-http scheme', async () => {
      // Arrange
      useTransport(() => ({ status: 302, redirectTo: 'file:///etc/passwd' }));

      // Act
      const result = await fetchText('https://example.com');

      // Assert
      expect(result).toEqual(SCHEME_ERROR);
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
      // Arrange
      const requests = useTransport(() => ({ status: 200, body: '' }));

      // Act
      const result = await fetchText(url, { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual(PRIVATE_HOST_ERROR);
      expect(requests).toHaveLength(0);
    });

    test('fetches a public address', async () => {
      // Arrange
      useTransport(() => ({ status: 200, body: 'ok' }));

      // Act
      const result = await fetchText('http://8.8.8.8/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: true, data: { body: 'ok', validators: { etag: undefined, last_modified: undefined } } });
    });

    test('refuses a name that resolves to a private address', async () => {
      // Arrange
      const requests = useTransport(() => ({ status: 200, body: '' }));
      mockedLookup.mockResolvedValue([{ address: '192.168.0.10', family: 4 }]);

      // Act
      const result = await fetchText('https://intranet.example/feed', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual(PRIVATE_HOST_ERROR);
      expect(requests).toHaveLength(0);
    });

    test('fetches a name that resolves to public addresses', async () => {
      // Arrange
      useTransport(() => ({ status: 200, body: 'ok' }));
      mockedLookup.mockResolvedValue([{ address: '93.184.216.34', family: 4 }]);

      // Act
      const result = await fetchText('https://example.com/feed', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: true, data: { body: 'ok', validators: { etag: undefined, last_modified: undefined } } });
      expect(mockedLookup).toHaveBeenCalledWith('example.com', { all: true });
    });

    test('reports a name that does not resolve as a network error', async () => {
      // Arrange
      const requests = useTransport(() => ({ status: 200, body: '' }));
      mockedLookup.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      // Act
      const result = await fetchText('https://missing.invalid/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'Could not resolve missing.invalid.' } });
      expect(requests).toHaveLength(0);
    });

    test('refuses a redirect from a public host to a private one', async () => {
      // Arrange
      const requests = useTransport((url) => (
        url === 'http://8.8.8.8/'
          ? { status: 302, redirectTo: 'http://127.0.0.1/admin' }
          : { status: 200, body: '' }
      ));

      // Act
      const result = await fetchText('http://8.8.8.8/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual(PRIVATE_HOST_ERROR);
      expect(requests).toHaveLength(1);
    });

    test('fetches a private address when the option is off', async () => {
      // Arrange
      const requests = useTransport(() => ({ status: 200, body: 'local' }));

      // Act
      const result = await fetchText('http://127.0.0.1/');

      // Assert
      expect(result).toEqual({ success: true, data: { body: 'local', validators: { etag: undefined, last_modified: undefined } } });
      expect(mockedLookup).not.toHaveBeenCalled();
      expect(requests).toHaveLength(1);
    });

    test('allowPrivateHosts lets a guarded fetch reach a private address', async () => {
      // Arrange: a fresh module instance, so the process-wide switch does not leak into other tests.
      vi.resetModules();
      const isolated = await import('./fetch');
      const { transport, requests } = stubTransport(() => ({ status: 200, body: 'local' }));
      isolated.setRequestTransport(transport);
      isolated.allowPrivateHosts();

      // Act
      const result = await isolated.fetchText('http://127.0.0.1/', { blockPrivateHosts: true });

      // Assert
      expect(result).toEqual({ success: true, data: { body: 'local', validators: { etag: undefined, last_modified: undefined } } });
      expect(requests).toHaveLength(1);
    });
  });
});

describe('fetchConditional', () => {
  afterEach(() => {
    setRequestTransport(undefined as unknown as RequestTransport);
    mockedLookup.mockReset();
  });

  test('replays the stored validators as conditional GET headers', async () => {
    // Arrange
    const requests = useTransport(() => ({ status: 200, body: 'fresh' }));

    // Act
    await fetchConditional('https://example.com/feed', { validators: { etag: '"v1"', last_modified: 'Tue, 15 Nov 1994 12:45:26 GMT' } });

    // Assert
    expect(requests[0]?.headers['If-None-Match']).toBe('"v1"');
    expect(requests[0]?.headers['If-Modified-Since']).toBe('Tue, 15 Nov 1994 12:45:26 GMT');
  });

  test('reports a 304 as notModified without reading a body', async () => {
    // Arrange
    useTransport(() => ({ status: 304 }));

    // Act
    const result = await fetchConditional('https://example.com/feed', { validators: { etag: '"v1"', last_modified: undefined } });

    // Assert
    expect(result).toEqual({ success: true, data: { notModified: true } });
  });

  test('treats a 304 as an error when no validator was sent', async () => {
    // Arrange
    useTransport(() => ({ status: 304 }));

    // Act
    const result = await fetchConditional('https://example.com/feed', { validators: { etag: undefined, last_modified: undefined } });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '304: ' } });
  });

  test('returns the fresh body and its new validators after a full download', async () => {
    // Arrange
    useTransport(() => ({ status: 200, body: 'fresh', headers: { ETag: '"v2"' } }));

    // Act
    const result = await fetchConditional('https://example.com/feed', { validators: { etag: '"v1"', last_modified: undefined } });

    // Assert
    expect(result).toEqual({ success: true, data: { body: 'fresh', validators: { etag: '"v2"', last_modified: undefined } } });
  });

  test('clears the validators when the new response carries none', async () => {
    // Arrange
    useTransport(() => ({ status: 200, body: 'fresh' }));

    // Act
    const result = await fetchConditional('https://example.com/feed', { validators: { etag: '"v1"', last_modified: undefined } });

    // Assert
    expect(result).toEqual({ success: true, data: { body: 'fresh', validators: { etag: undefined, last_modified: undefined } } });
  });
});

describe('fetchText against a real server', () => {
  let server: Server;
  let url: string;
  const seenRequests: { url: string | undefined; userAgent: string | undefined; ifNoneMatch: string | undefined }[] = [];

  const handler: RequestListener = (request, response) => {
    seenRequests.push({ url: request.url, userAgent: request.headers['user-agent'], ifNoneMatch: request.headers['if-none-match'] });
    if (request.url === '/redirect') {
      response.writeHead(302, { location: '/final' });
      response.end();
      return;
    }
    if (request.url === '/final') {
      response.writeHead(200, { etag: '"v1"' });
      response.end('final');
      return;
    }
    if (request.url === '/loop') {
      response.writeHead(302, { location: '/loop' });
      response.end();
      return;
    }
    if (request.url === '/hang') {
      return;
    }
    response.writeHead(200);
    // Never call response.end(): simulates a server that accepts the connection and stays silent.
  };

  beforeAll(async () => {
    server = createServer(handler);
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    const { port } = server.address() as AddressInfo;
    url = `http://127.0.0.1:${port}`;
    // The real-server tests exercise the fetch loop itself with a transport built on stock fetch,
    // which implements the same hop contract as Electron's.
    setRequestTransport(fetchTransport);
  });

  afterAll(async () => {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  // A RequestTransport built on the stock fetch, faithful to the hop contract: manual redirects
  // surface as a redirectUrl hop, everything else as a readable response.
  const fetchTransport: RequestTransport = async (target, headers, signal) => {
    const response = await fetch(target.href, { headers, redirect: 'manual', signal });
    const location = response.headers.get('location');
    if ([301, 302, 303, 307, 308].includes(response.status) && location !== null) {
      void response.body?.cancel();
      return { status: response.status, statusMessage: response.statusText, headers: {}, redirectUrl: location, abort: () => undefined };
    }
    return {
      status: response.status,
      statusMessage: response.statusText,
      headers: Object.fromEntries([...response.headers.entries()]),
      readBody: async () => ({ success: true, data: await response.text() }),
      abort: () => void response.body?.cancel(),
    };
  };

  afterEach(() => {
    seenRequests.length = 0;
  });

  test('sends the monfil user agent to a real server', async () => {
    // Act
    await fetchText(`${url}/final`);

    // Assert
    expect(seenRequests[0]?.userAgent).toMatch(/^monfil\//);
  });

  test('times out on a server that never answers', async () => {
    // Act
    const result = await fetchText(url, { timeoutMs: 20 });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'The server took too long to answer.' } });
  });

  test('follows a real redirect', async () => {
    // Act
    const result = await fetchText(`${url}/redirect`);

    // Assert
    expect(result).toEqual({ success: true, data: { body: 'final', validators: { etag: '"v1"', last_modified: undefined } } });
  });

  test('stops a real redirect loop', async () => {
    // Act
    const result = await fetchText(`${url}/loop`);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'Too many redirects.' } });
  });

  test('refuses the loopback server when private hosts are blocked', async () => {
    // Act
    const result = await fetchText(`${url}/final`, { blockPrivateHosts: true });

    // Assert
    expect(result).toEqual(PRIVATE_HOST_ERROR);
  });
});
