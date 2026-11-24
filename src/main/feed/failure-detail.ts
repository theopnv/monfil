// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { CodedError } from '../../shared/errors';

/** The reasons a fetch gives. Other params of a failure can hold a host or a title, so only these values leave the error. */
const FETCH_REASONS: ReadonlySet<string> = new Set([
  'refused', 'notFound', 'rateLimited', 'serverError', 'other', 'redirects', 'unresolvable', 'dropped', 'protocol', 'private', 'htmlPage',
]);

export interface FailureDetail {
  status?: number;
  reason?: string;
}

/** What tells apart two failures of the same kind without naming the feed: the HTTP status and the reason, never the host. */
export function failureDetail(error: CodedError): FailureDetail {
  const { status, reason } = error.params ?? {};
  return {
    ...(typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599 ? { status } : {}),
    ...(typeof reason === 'string' && FETCH_REASONS.has(reason) ? { reason } : {}),
  };
}
