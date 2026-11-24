// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { UsageCounter } from '../../shared/contracts';

export type RefreshErrorBucket = 'timeout' | 'http_4xx' | 'http_5xx' | 'tls' | 'dns' | 'parse' | 'too_large';

interface CodedError {
  name: string;
  message: string;
  params?: { status?: unknown };
}

function isCodedError(value: unknown): value is CodedError {
  return typeof value === 'object' && value !== null
    && 'name' in value && typeof value.name === 'string'
    && 'message' in value && typeof value.message === 'string';
}

function bucketOfStatus(status: unknown): RefreshErrorBucket | undefined {
  if (typeof status !== 'number') {
    return undefined;
  }
  if (status >= 500) {
    return 'http_5xx';
  }
  return status >= 400 ? 'http_4xx' : undefined;
}

function bucketOfTransportMessage(message: string): RefreshErrorBucket | undefined {
  if (/ERR_NAME_NOT_RESOLVED|ENOTFOUND|could not resolve/i.test(message)) {
    return 'dns';
  }
  if (/ERR_CERT|ERR_SSL|ERR_TLS|certificate/i.test(message)) {
    return 'tls';
  }
  return /time[ds]?[ _-]?out/i.test(message) ? 'timeout' : undefined;
}

/** Sorts a failed feed fetch into a coarse cause. It reads the error but never keeps its text, which can hold a host name. */
export function refreshErrorBucket(error: unknown): RefreshErrorBucket | undefined {
  if (!isCodedError(error)) {
    return undefined;
  }
  switch (error.name) {
    case 'RESPONSE_TOO_LARGE_ERROR': return 'too_large';
    case 'PARSE_ERROR':
    case 'UNSUPPORTED_FORMAT': return 'parse';
    case 'GENERIC_FETCH_ERROR': return bucketOfStatus(error.params?.status);
    case 'NETWORK_ERROR':
    case 'NOT_ALLOWED_OR_ABORTED_ERROR': return bucketOfTransportMessage(error.message);
    default: return undefined;
  }
}

export function refreshErrorCounter(error: unknown): UsageCounter | undefined {
  const bucket = refreshErrorBucket(error);
  return bucket ? `refresh_error_${bucket}` : undefined;
}
