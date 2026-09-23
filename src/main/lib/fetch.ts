import { app, net } from 'electron';
import type { Result } from '../../shared/result.ts';
import type { FetchUrlError } from '../../shared/contracts.ts';
import { FETCH_TIMEOUT_MS, MAX_FETCH_BYTES, MAX_REDIRECTS } from '../constants.ts';
import { classifyHost } from './private-network.ts';

export interface FetchValidators {
  etag: string | undefined;
  last_modified: string | undefined;
}

export interface FetchUrlOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
  /** Refuses hosts on loopback, link-local or private ranges. Set it for every URL a feed chose rather than the user. */
  blockPrivateHosts?: boolean;
}

export interface ConditionalFetchOptions extends FetchUrlOptions {
  /** Validators from the previous fetch of this resource, replayed as `If-None-Match` / `If-Modified-Since`. */
  validators: FetchValidators;
}

/** The body plus the validators to store for the next conditional GET. */
export interface FetchedText {
  body: string;
  validators: FetchValidators;
}

/** A 304 answer: the stored validators still describe the newest version, nothing to download. */
export interface NotModified {
  notModified: true;
}

export type FetchedResource = FetchedText | NotModified;

export type FetchTextResult = Result<FetchedText, FetchUrlError>;
export type ConditionalFetchResult = Result<FetchedResource, FetchUrlError>;

const REDIRECT_ERROR: FetchTextResult = { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: 'Too many redirects.' } };

function userAgent(): string {
  return `monfil/${app.getVersion()} (+https://github.com/theopnv/monfil)`;
}

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

function headerValue(headers: Record<string, string | string[]>, name: string): string | undefined {
  const value = headers[name] ?? headers[name.toLowerCase()];
  if (value === undefined) {
    return undefined;
  }
  return Array.isArray(value) ? value[0] : value;
}

function validatorsOf(headers: Record<string, string | string[]>): FetchValidators {
  return {
    etag: headerValue(headers, 'ETag'),
    last_modified: headerValue(headers, 'Last-Modified'),
  };
}

function hasValidator(validators: FetchValidators): boolean {
  return validators.etag !== undefined || validators.last_modified !== undefined;
}

/** One stop of the redirect loop: either the transport stopped at a redirect, or a full response. */
interface RedirectHop {
  status: number;
  statusMessage: string;
  headers: Record<string, string | string[]>;
  /** May be relative, so resolved against the current target. */
  redirectUrl: string;
  abort: () => void;
}

interface ResponseHop {
  status: number;
  statusMessage: string;
  headers: Record<string, string | string[]>;
  /** Reads the body as UTF-8, capped at MAX_FETCH_BYTES. */
  readBody: () => Promise<Result<string, FetchUrlError>>;
  /** Cancels the request, releasing its connection. Safe to call once the hop has settled. */
  abort: () => void;
}

type HopOutcome = RedirectHop | ResponseHop;

export type RequestTransport = (target: URL, headers: Record<string, string>, signal: AbortSignal) => Promise<HopOutcome>;

// Indirection over Electron's Chromium transport, so tests can drive the redirect loop and the
// byte cap against a real HTTP server without an Electron runtime.
let transport: RequestTransport = chromiumTransport;

/**
 * Swaps the transport behind every fetch. Test-only: nothing outside the unit suite has a reason
 * to call it.
 */
export function setRequestTransport(substitute: RequestTransport): void {
  transport = substitute;
}

/**
 * One `net.request` round trip, stopped at redirects instead of following them, so the fetch loop
 * can re-run the scheme and private-host checks on every hop. Cookies stay off: `useSessionCookies`
 * defaults to false, so requests carry none, like the plain Node fetch this replaces.
 */
async function chromiumTransport(target: URL, headers: Record<string, string>, signal: AbortSignal): Promise<HopOutcome> {
  return new Promise((resolve, reject) => {
    const request = net.request({ url: target.href, redirect: 'manual' });
    for (const [name, value] of Object.entries(headers)) {
      request.setHeader(name, value);
    }

    const onAbort = () => {
      request.abort();
      reject(abortError());
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });

    let settled = false;
    const settle = (run: () => void) => {
      if (settled) {
        return;
      }
      settled = true;
      signal.removeEventListener('abort', onAbort);
      run();
    };

    request.on('redirect', (statusCode: number, _method: string, redirectUrl: string) => {
      settle(() => {
        request.abort();
        resolve({ status: statusCode, statusMessage: '', headers: {}, redirectUrl, abort: request.abort.bind(request) });
      });
    });
    request.on('response', (response) => {
      settle(() => resolve({
        status: response.statusCode,
        statusMessage: response.statusMessage,
        headers: response.headers as Record<string, string | string[]>,
        readBody: () => readCappedText(response, request),
        abort: () => {
          request.abort();
          response.removeAllListeners();
        },
      }));
    });
    request.on('error', (error) => {
      settle(() => reject(error instanceof Error ? error : new Error(String(error))));
    });
    request.end();
  });
}

function abortError(): Error {
  const error = new Error('Request was aborted or not allowed');
  error.name = 'AbortError';
  return error;
}

// Aborting an Electron response mid-body fires no 'error' (only 'close' on the request), so the
// signal is raced against every await to guarantee the fetch always settles.
function raceAbort<T>(promise: Promise<T>, signal: AbortSignal, abort?: () => void): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => {
      try {
        abort?.();
      } catch {
        // The request may already be closed when the signal fires.
      }
      const timedOut = signal.reason instanceof DOMException && signal.reason.name === 'TimeoutError';
      const error = abortError();
      if (timedOut) {
        error.message = 'The server took too long to answer.';
      }
      reject(error);
    };
    if (signal.aborted) {
      onAbort();
      return;
    }
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

// Mirrors what `Response.text()` does (UTF-8, BOM-stripped), but as a stream so a cap can be
// enforced without holding the whole body in memory first.
function readCappedText(
  response: Electron.IncomingMessage,
  request: Electron.ClientRequest,
): Promise<Result<string, FetchUrlError>> {
  const contentLength = headerValue(response.headers as Record<string, string | string[]>, 'Content-Length');
  if (contentLength && Number(contentLength) > MAX_FETCH_BYTES) {
    request.abort();
    return Promise.resolve(tooLarge());
  }

  return new Promise((resolve) => {
    const decoder = new TextDecoder();
    let text = '';
    let bytesRead = 0;
    let done = false;

    const finish = (result: Result<string, FetchUrlError>) => {
      if (done) {
        return;
      }
      done = true;
      response.removeAllListeners();
      resolve(result);
    };

    response.on('data', (chunk: Buffer) => {
      bytesRead += chunk.byteLength;
      if (bytesRead > MAX_FETCH_BYTES) {
        request.abort();
        finish(tooLarge());
        return;
      }
      text += decoder.decode(chunk, { stream: true });
    });
    response.on('end', () => finish({ success: true, data: text + decoder.decode() }));
    response.on('error', () => {
      request.abort();
      finish({ success: false, error: { name: 'NETWORK_ERROR', message: 'The connection dropped while reading the response.' } });
    });
  });
}

async function fetchResource(
  url: string,
  options: FetchUrlOptions & { validators?: FetchValidators },
  allowNotModified: boolean,
): Promise<Result<FetchedResource, FetchUrlError>> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  try {
    let target = new URL(url);
    const headers: Record<string, string> = {
      'User-Agent': userAgent(),
      // Chromium's HTTP cache would otherwise answer within `max-age` without contacting the
      // server, which would leave the stored validators looking fresher than they are.
      'Cache-Control': 'no-cache',
    };
    if (options.validators?.etag !== undefined) {
      headers['If-None-Match'] = options.validators.etag;
    }
    if (options.validators?.last_modified !== undefined) {
      headers['If-Modified-Since'] = options.validators.last_modified;
    }

    for (let redirects = 0; ; redirects += 1) {
      if (signal.aborted) {
        throw abortError();
      }
      const refusal = await findRefusal(target, options.blockPrivateHosts ?? false);
      if (refusal) {
        return { success: false, error: refusal };
      }

      const hop = await raceAbort(transport(target, headers, signal), signal);
      if ('redirectUrl' in hop) {
        if (redirects >= MAX_REDIRECTS) {
          hop.abort();
          return REDIRECT_ERROR;
        }
        target = new URL(hop.redirectUrl, target);
        continue;
      }

      if (hop.status === 304) {
        hop.abort();
        if (allowNotModified && hasValidator(options.validators ?? { etag: undefined, last_modified: undefined })) {
          return { success: true, data: { notModified: true } };
        }
        return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: `${hop.status}: ${hop.statusMessage}` } };
      }
      if (hop.status < 200 || hop.status >= 300) {
        hop.abort();
        return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: `${hop.status}: ${hop.statusMessage}` } };
      }

      const body = await raceAbort(hop.readBody(), signal, hop.abort);
      if (!body.success) {
        hop.abort();
        return body;
      }
      const validators = validatorsOf(hop.headers);
      if (!hasValidator(validators)) {
        // A body without validators cannot be conditional-GET next time; clear whatever is stored
        // so a later refresh never replays a dead `If-None-Match`.
        return { success: true, data: { body: body.data, validators: { etag: undefined, last_modified: undefined } } };
      }
      return { success: true, data: { body: body.data, validators } };
    }

  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: { name: 'NOT_ALLOWED_OR_ABORTED_ERROR', message: error.message } };
    }
    // Chromium reports every transport failure (DNS, refused, TLS) as a plain Error.
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: { name: 'NETWORK_ERROR', message } };
  }
}

/**
 * Fetches a URL as text over Chromium's network stack, following redirects one hop at a time so
 * every target, not only the first, goes through the scheme and private-host checks.
 * @param url the address to fetch; only http and https are accepted
 * @param options an abort signal, a timeout covering all hops, and whether private hosts are refused
 * @returns the body with the response's validators, or a tagged error
 */
export async function fetchText(url: string, options: FetchUrlOptions = {}): Promise<FetchTextResult> {
  const outcome = await fetchResource(url, options, false);
  return outcome as FetchTextResult;
}

/**
 * Fetches a URL as text with a conditional GET, following redirects one hop at a time so every
 * target, not only the first, goes through the scheme and private-host checks.
 * @param url the address to fetch; only http and https are accepted
 * @param options the validators from the previous fetch, plus an abort signal, a timeout and
 *   whether private hosts are refused
 * @returns a 304 when the validators still hold, the fresh body with its validators otherwise, or a tagged error
 */
export async function fetchConditional(url: string, options: ConditionalFetchOptions): Promise<ConditionalFetchResult> {
  return fetchResource(url, options, true);
}
