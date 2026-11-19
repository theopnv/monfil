// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { TFunction } from 'i18next';
import type { CodedError, ErrorParams } from '../../shared/errors';

type ErrorT = TFunction<'errors'>;

// Names whose `message` is raw technical text: it helps a bug report but means little to a user.
const TECHNICAL_NAMES: ReadonlySet<string> = new Set([
  'DB_ERROR',
  'FS_ERROR',
  'BACKUP_FAILED',
  'MALFORMED_XML',
  'NETWORK_ERROR',
  'NOT_ALLOWED_OR_ABORTED_ERROR',
  'PARSE_ERROR',
  'UNKNOWN_ERROR',
]);

/** Translates an error by its stable `name`. The `reason` param picks a variant of the sentence; the other params fill it. */
export function translateError(t: ErrorT, error: { name: string; params?: ErrorParams | null | undefined }): string {
  const { reason, ...values } = error.params ?? {};
  // Stryker disable next-line ConditionalExpression: an undefined context makes i18next look up the plain key, the same as no context
  const options = { ...values, ...(typeof reason === 'string' ? { context: reason } : {}) };
  // The name is data from main, so the key cannot be checked at compile time.
  return t(`codes.${error.name}` as 'codes.UNKNOWN', { ...options, defaultValue: t('codes.UNKNOWN') });
}

/** The raw English text to show on a "Details" line, or undefined when the sentence already says everything. */
export function errorDetails(error: Pick<CodedError, 'name' | 'message' | 'params'>): string | undefined {
  const hasVariant = typeof error.params?.['reason'] === 'string';
  return TECHNICAL_NAMES.has(error.name) && !hasVariant && error.message ? error.message : undefined;
}

/** The sentence for the last failed refresh of a feed. A row stored before error codes existed has no code and gets a generic sentence. */
export function translateFeedFailure(t: ErrorT, failure: { code?: string | null | undefined; params?: ErrorParams | null | undefined }): string {
  return failure.code ? translateError(t, { name: failure.code, params: failure.params }) : t('feedFailure.unknown');
}

/** The translated sentence and its Details line as one string, for places that cannot render two lines. */
export function translateErrorWithDetails(t: ErrorT, error: Pick<CodedError, 'name' | 'message' | 'params'>): string {
  const details = errorDetails(error);
  return details ? `${translateError(t, error)} ${t('details', { message: details })}` : translateError(t, error);
}
