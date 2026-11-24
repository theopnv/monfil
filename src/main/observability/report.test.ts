// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import * as Sentry from '@sentry/electron/main';
import { ERROR_REPORT_COMMENT_MAX_LENGTH, ERROR_REPORT_LOG_MAX_BYTES } from '../../shared/contracts';
import { forgetReportedEvents, rememberReportedEvent } from './incidents';
import { readLogTail } from './log-tail';
import { createScrubber } from './scrub';
import { flushReports, getErrorReportState, previewReportLog, submitErrorReport } from './report';
import { getScrubber, getSdk, isObservabilityActive } from './sentry';
import { capturesSettled } from './routing';

vi.mock(import('@sentry/electron/main'), () => ({ captureFeedback: vi.fn(), flush: vi.fn(() => Promise.resolve(true)) }) as never);
vi.mock(import('./sentry'), () => ({ getScrubber: vi.fn(), getSdk: vi.fn(), isObservabilityActive: vi.fn() }));
vi.mock(import('./routing'), () => ({ capturesSettled: vi.fn(() => Promise.resolve()) }));
vi.mock(import('./log-tail'), () => ({ readLogTail: vi.fn() }));
vi.mock(import('../app/main-state'), () => ({ logFilePath: '/logs/monfil.log' }));

const scrubber = createScrubber({ homeDir: '/Users/jane', userDataDir: '/Users/jane/Library/monfil' });

beforeEach(() => {
  vi.mocked(isObservabilityActive).mockReturnValue(true);
  vi.mocked(getSdk).mockReturnValue(Sentry);
  vi.mocked(getScrubber).mockReturnValue(scrubber);
  vi.mocked(readLogTail).mockResolvedValue({ text: 'opened /Users/jane/Documents/a.opml\n', truncated: false });
  rememberReportedEvent('abcd1234', 'event-1');
});

afterEach(() => {
  forgetReportedEvents();
});

describe('flushReports', () => {
  test('waits for the captures that are pending, then flushes the SDK', async () => {
    // Arrange
    const order: string[] = [];
    vi.mocked(capturesSettled).mockImplementation(async () => {
      order.push('settled');
    });
    vi.mocked(Sentry.flush).mockImplementation(async () => {
      order.push('flush');
      return true;
    });

    // Act
    await flushReports();

    // Assert
    expect(order).toEqual(['settled', 'flush']);
    expect(Sentry.flush).toHaveBeenCalledWith(3000);
  });

  test('does nothing while error reports are off', async () => {
    // Arrange
    vi.mocked(getSdk).mockReturnValue(undefined);

    // Act
    await flushReports();

    // Assert
    expect(capturesSettled).not.toHaveBeenCalled();
    expect(Sentry.flush).not.toHaveBeenCalled();
  });
});

describe('getErrorReportState', () => {
  test.each([[true], [false]])('is enabled only while the SDK runs (%s)', (active) => {
    // Arrange
    vi.mocked(isObservabilityActive).mockReturnValue(active);

    // Act, Assert
    expect(getErrorReportState()).toEqual({ enabled: active });
  });
});

describe('previewReportLog', () => {
  test('gives the scrubbed end of the log, capped at 1 MB', async () => {
    // Act
    const preview = await previewReportLog();

    // Assert
    expect(preview).toEqual({ text: 'opened ~/Documents/a.opml\n', truncated: false });
    expect(readLogTail).toHaveBeenCalledWith('/logs/monfil.log', ERROR_REPORT_LOG_MAX_BYTES);
  });

  test('says when the log was cut', async () => {
    // Arrange
    vi.mocked(readLogTail).mockResolvedValue({ text: 'x', truncated: true });

    // Act, Assert
    await expect(previewReportLog()).resolves.toMatchObject({ truncated: true });
  });

  test('reads nothing while error reports are off', async () => {
    // Arrange
    vi.mocked(getScrubber).mockReturnValue(undefined);

    // Act
    const preview = await previewReportLog();

    // Assert
    expect(preview).toEqual({ text: '', truncated: false });
    expect(readLogTail).not.toHaveBeenCalled();
  });
});

describe('submitErrorReport', () => {
  test('sends the comment as feedback on the event of the incident', async () => {
    // Act
    const result = await submitErrorReport({ incidentId: 'abcd1234', comment: '  It broke when I opened settings  ', attachLog: false });

    // Assert
    expect(result).toEqual({ success: true, data: undefined });
    expect(Sentry.captureFeedback).toHaveBeenCalledWith({ message: 'It broke when I opened settings', associatedEventId: 'event-1' }, { attachments: [] });
    expect(Sentry.flush).toHaveBeenCalled();
  });

  test('attaches the scrubbed log only when asked', async () => {
    // Act
    await submitErrorReport({ incidentId: 'abcd1234', comment: 'see log', attachLog: true });

    // Assert
    expect(Sentry.captureFeedback).toHaveBeenCalledWith(
      { message: 'see log', associatedEventId: 'event-1' },
      { attachments: [{ filename: 'monfil.log', contentType: 'text/plain', data: 'opened ~/Documents/a.opml\n' }] },
    );
  });

  test('sends a placeholder message when only the log is sent', async () => {
    // Act
    await submitErrorReport({ incidentId: 'abcd1234', comment: '   ', attachLog: true });

    // Assert
    expect(vi.mocked(Sentry.captureFeedback).mock.calls[0]?.[0]).toEqual({ message: '(no comment)', associatedEventId: 'event-1' });
  });

  test('cuts a comment that is too long', async () => {
    // Act
    await submitErrorReport({ incidentId: 'abcd1234', comment: 'a'.repeat(ERROR_REPORT_COMMENT_MAX_LENGTH + 50), attachLog: false });

    // Assert
    expect(vi.mocked(Sentry.captureFeedback).mock.calls[0]?.[0].message).toHaveLength(ERROR_REPORT_COMMENT_MAX_LENGTH);
  });

  test('sends nothing when there is no comment and no log', async () => {
    // Act
    const result = await submitErrorReport({ incidentId: 'abcd1234', comment: '', attachLog: false });

    // Assert
    expect(result.success).toBe(true);
    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
  });

  test('uses the latest event when the incident is unknown or missing', async () => {
    // Act
    await submitErrorReport({ incidentId: 'zzzzzzzz', comment: 'one', attachLog: false });
    await submitErrorReport({ comment: 'two', attachLog: false });

    // Assert
    expect(vi.mocked(Sentry.captureFeedback).mock.calls.map(([params]) => params.associatedEventId)).toEqual(['event-1', 'event-1']);
  });

  test('refuses while error reports are off', async () => {
    // Arrange
    vi.mocked(getSdk).mockReturnValue(undefined);

    // Act
    const result = await submitErrorReport({ incidentId: 'abcd1234', comment: 'hello', attachLog: true });

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'REPORTS_OFF' } });
    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
  });

  test('refuses when no report was sent for the session', async () => {
    // Arrange
    forgetReportedEvents();

    // Act
    const result = await submitErrorReport({ incidentId: 'abcd1234', comment: 'hello', attachLog: false });

    // Assert
    expect(result).toMatchObject({ success: false, error: { name: 'NO_EVENT' } });
    expect(Sentry.captureFeedback).not.toHaveBeenCalled();
  });
});
