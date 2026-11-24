// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { logFilePath } from '../app/main-state';
import { ERROR_REPORT_COMMENT_MAX_LENGTH, ERROR_REPORT_LOG_MAX_BYTES, type ErrorReportError, type ErrorReportInput, type ErrorReportLogPreview, type ErrorReportState } from '../../shared/contracts';
import { fail, ok, type Result } from '../../shared/result';
import { findReportedEvent } from './incidents';
import { capturesSettled } from './routing';
import { readLogTail } from './log-tail';
import { getScrubber, getSdk, isObservabilityActive } from './sentry';

const NO_COMMENT = '(no comment)';
const FLUSH_TIMEOUT_MS = 3000;

/**
 * Sends what was logged so far. The fatal dialog calls it before it opens, because a native dialog stops the
 * main process from doing the network work that a report needs until the user closes it.
 */
export async function flushReports(): Promise<void> {
  const Sentry = getSdk();
  if (!Sentry) {
    return;
  }
  await capturesSettled();
  await Sentry.flush(FLUSH_TIMEOUT_MS);
}

export function getErrorReportState(): ErrorReportState {
  return { enabled: isObservabilityActive() };
}

/** The part of the log that a report attaches, after the scrubber ran. It is what the user sees before they tick the box. */
export async function previewReportLog(): Promise<ErrorReportLogPreview> {
  const scrubber = getScrubber();
  if (!scrubber) {
    return { text: '', truncated: false };
  }
  const tail = await readLogTail(logFilePath, ERROR_REPORT_LOG_MAX_BYTES);
  return { text: scrubber.string(tail.text), truncated: tail.truncated };
}

/** Sends a comment, and the log when asked, as feedback on the report of an incident. It sends nothing while error reports are off. */
export async function submitErrorReport(input: ErrorReportInput): Promise<Result<undefined, ErrorReportError>> {
  const Sentry = getSdk();
  if (!Sentry) {
    return fail('REPORTS_OFF', 'Error reports are off.');
  }
  const eventId = findReportedEvent(input.incidentId);
  if (!eventId) {
    return fail('NO_EVENT', 'No error report was sent for this incident.');
  }
  const comment = input.comment.trim().slice(0, ERROR_REPORT_COMMENT_MAX_LENGTH);
  if (comment === '' && !input.attachLog) {
    return ok();
  }
  const attachments = input.attachLog
    ? [{ filename: 'monfil.log', contentType: 'text/plain', data: (await previewReportLog()).text }]
    : [];
  Sentry.captureFeedback({ message: comment || NO_COMMENT, associatedEventId: eventId }, { attachments });
  await Sentry.flush(FLUSH_TIMEOUT_MS);
  return ok();
}
