import type { Result } from './utils.ts'
import { FETCH_TIMEOUT_MS, MAX_FETCH_BYTES } from '../constants.ts'

interface GenericFetchError extends Error {
  name: 'GENERIC_FETCH_ERROR';
}

interface NetworkError extends Error {
  name: 'NETWORK_ERROR';
}

interface NotAllowedOrAbortedError extends Error {
  name: 'NOT_ALLOWED_OR_ABORTED_ERROR';
}

interface ResponseTooLargeError extends Error {
  name: 'RESPONSE_TOO_LARGE_ERROR';
}

export type FetchUrlError = GenericFetchError | NetworkError | NotAllowedOrAbortedError | ResponseTooLargeError;
type FetchUrlResult = Result<string, FetchUrlError>;

function tooLarge(): Result<string, ResponseTooLargeError> {
  return { success: false, error: { name: 'RESPONSE_TOO_LARGE_ERROR', message: 'This feed is too large to read.' } };
}

// Mirrors what `Response.text()` does (UTF-8, BOM-stripped), but as a stream so a cap can be
// enforced without holding the whole body in memory first.
async function readCappedText(response: Response): Promise<Result<string, ResponseTooLargeError>> {
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

export async function fetchUrl(url: string, options: { signal?: AbortSignal; timeoutMs?: number } = {}): Promise<FetchUrlResult> {
  const timeout = AbortSignal.timeout(options.timeoutMs ?? FETCH_TIMEOUT_MS);
  const signal = options.signal ? AbortSignal.any([options.signal, timeout]) : timeout;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) {
      return { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: `${response.status}: ${response.statusText}` } }
    }
    return await readCappedText(response);

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
