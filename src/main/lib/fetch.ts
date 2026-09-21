import type { Result } from '../../shared/result.ts'
import type { FetchUrlError } from '../../shared/contracts.ts'
import { FETCH_TIMEOUT_MS, MAX_FETCH_BYTES, MAX_REDIRECTS } from '../constants.ts'
import { classifyHost } from './private-network.ts'

type FetchUrlResult = Result<string, FetchUrlError>;

export interface FetchUrlOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Refuses hosts on loopback, link-local or private ranges. Set it for every URL a feed chose rather than the user. */
  blockPrivateHosts?: boolean;
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);

let privateHostsAllowed = false;

/**
 * Turns `blockPrivateHosts` into a no-op for the rest of the process. Only the e2e runner calls
 * it: its feed and article server listens on 127.0.0.1.
 */
export function allowPrivateHosts(): void {
  privateHostsAllowed = true;
}

function tooLarge(): Result<string, Extract<FetchUrlError, { name: 'RESPONSE_TOO_LARGE_ERROR' }>> {
  return { success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } };
}

function blocked(message: string): Extract<FetchUrlError, { name: 'BLOCKED_URL_ERROR' }> {
  return { name: 'BLOCKED_URL_ERROR', message };
}

async function findRefusal(target: URL, blockPrivateHosts: boolean): Promise<FetchUrlError | undefined> {
  if (target.protocol !== 'http:' && target.protocol !== 'https:') {
    return blocked('Only http and https addresses can be fetched.');
  }
  if (!blockPrivateHosts || privateHostsAllowed) {
    return undefined;
  }

  const hostClass = await classifyHost(target.hostname);
  switch (hostClass) {
    case 'public':
      return undefined;
    case 'private':
      return blocked('This address is not on the public internet.');
    case 'unresolvable':
      return { name: 'NETWORK_ERROR', message: `Could not resolve ${target.hostname}.` };
    default: {
      const exhaustiveCheck: never = hostClass;
      return exhaustiveCheck;
    }
  }
}

// Mirrors what `Response.text()` does (UTF-8, BOM-stripped), but as a stream so a cap can be
// enforced without holding the whole body in memory first.
async function readCappedText(response: Response): Promise<Result<string, Extract<FetchUrlError, { name: 'RESPONSE_TOO_LARGE_ERROR' }>>> {
  const contentLength = response.headers.get('content-length');
  if (contentLength && Number(contentLength) > MAX_FETCH_BYTES) {
    return tooLarge();
  }

  if (!response.body) {
    return { success: true, data: '' };
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let text = '';
  let bytesRead = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      return { success: true, data: text + decoder.decode() };
    }

    bytesRead += value.byteLength;
    if (bytesRead > MAX_FETCH_BYTES) {
      void reader.cancel().catch(() => undefined);
      return tooLarge();
    }

    text += decoder.decode(value, { stream: true });
  }
}

/**
 * Fetches a URL as text, following redirects one hop at a time so every target, not only the
 * first, goes through the scheme and private-host checks.
 * @param url the address to fetch; only http and https are accepted
 * @param options an abort signal, a timeout covering all hops, and whether private hosts are refused
 * @returns the body as text, or a tagged error
 */
export async function fetchUrl(url: string, options: FetchUrlOptions = {}): Promise<FetchUrlResult> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  try {
    let target = new URL(url);
    for (let redirects = 0; ; redirects += 1) {
      const refusal = await findRefusal(target, options.blockPrivateHosts ?? false);
      if (refusal) {
        return { success: false, error: refusal };
      }

      const response = await fetch(target.href, { signal, redirect: 'manual' });
      const location = response.headers.get('location');
      if (REDIRECT_STATUSES.has(response.status) && location !== null) {
        void response.body?.cancel().catch(() => undefined);
        if (redirects >= MAX_REDIRECTS) {
          return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'Too many redirects.' } };
        }
        target = new URL(location, target);
        continue;
      }

      if (!response.ok) {
        return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: `${response.status}: ${response.statusText}` } }
      }
      return await readCappedText(response);
    }

  } catch (error) {
    if (error instanceof TypeError) {
      return { success: false, error: { name: 'NETWORK_ERROR', message: error.message } }
    } else if (error instanceof DOMException && error.name === 'TimeoutError') {
      return { success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'The server took too long to answer.' } }
    } else if (error instanceof DOMException && (error.name === 'AbortError' || error.name === 'NotAllowedError')) {
      return { success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: 'Request was aborted or not allowed' } }
    } else {
      return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'An unknown error occurred' } }
    }
  }
}
