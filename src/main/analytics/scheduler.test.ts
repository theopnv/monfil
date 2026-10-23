// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { incrementCounter, setCountingEnabled } from './counters';
import { setPreferencesSnapshot } from './preferences';
import { flushUsageAnalytics, sendConsentGranted, startUsageAnalytics, stopUsageAnalytics, summaryTimestamp } from './scheduler';
import { isCountingEnabled } from './counters';
import { getUsageAnalyticsPromptHistory, setUsageAnalyticsConsent } from '../app/settings';
import { observeLogs } from '../logging/logger';
import { getAnalyticsEndpoint } from './config';
import { sendEvents } from './client';
import { logger } from '../logging/logger';

vi.mock(import('./config'), () => ({ getAnalyticsEndpoint: vi.fn() }));
vi.mock(import('./client'), () => ({ sendEvents: vi.fn() }));
vi.mock(import('../logging/logger'), () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() }, observeLogs: vi.fn() }));

const endpoint = { name: 'ENABLED' as const, url: 'https://eu.aptabase.com/api/v0/events', key: 'A-EU-1' };
const now = new Date('2026-10-23T08:00:00Z');

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

beforeEach(() => {
  vi.mocked(getAnalyticsEndpoint).mockReturnValue(endpoint);
  vi.mocked(sendEvents).mockResolvedValue({ ok: true });
  setCountingEnabled(true);
});

afterEach(async () => {
  await db.deleteFrom('usage_counter').execute();
});

async function remainingDays() {
  return (await db.selectFrom('usage_counter').select('day').distinct().orderBy('day').execute()).map((row) => row.day);
}

describe('summaryTimestamp', () => {
  test('uses the end of the day when it is less than 24 hours old', () => {
    // Act, Assert
    expect(summaryTimestamp('2026-10-22', new Date('2026-10-23T22:59:00Z')).toISOString()).toBe('2026-10-22T23:59:59.999Z');
  });

  test('uses the current time once the end of the day is 24 hours old or more', () => {
    // Act, Assert
    expect(summaryTimestamp('2026-10-22', new Date('2026-10-24T00:00:00Z')).toISOString()).toBe('2026-10-24T00:00:00.000Z');
    expect(summaryTimestamp('2026-10-22', new Date('2026-10-24T01:00:00Z')).toISOString()).toBe('2026-10-24T01:00:00.000Z');
  });

  test('uses the current time when the end of the day is exactly 24 hours old', () => {
    // Act, Assert
    expect(summaryTimestamp('2026-10-22', new Date('2026-10-23T23:59:59.999Z')).toISOString()).toBe('2026-10-23T23:59:59.999Z');
    expect(summaryTimestamp('2026-10-22', new Date('2026-10-23T23:59:59.998Z')).toISOString()).toBe('2026-10-22T23:59:59.999Z');
  });

  test('never goes into the future', () => {
    // Act, Assert
    expect(summaryTimestamp('2026-10-23', now).toISOString()).toBe(now.toISOString());
  });
});

describe('flushUsageAnalytics', () => {
  test('sends one summary for a finished day, then deletes it after a 2xx', async () => {
    // Arrange
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));
    setPreferencesSnapshot({ density: 'Cards', theme: 'light', hideReadItems: false, markReadOnScroll: true, openLinksExternally: false, keyboardNavigation: true });

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    expect(sendEvents).toHaveBeenCalledExactlyOnceWith(endpoint, [
      expect.objectContaining({ eventName: 'daily_summary', timestamp: '2026-10-22T23:59:59.999Z', props: expect.objectContaining({ day: '2026-10-22', articles_opened: 1, pref_density: 'Cards' }) }),
    ]);
    await expect(remainingDays()).resolves.toEqual([]);
    expect(logger.info).toHaveBeenCalledWith('app.analytics', { outcome: 'sent', events: 1 });
    expect(logger.info).not.toHaveBeenCalledWith('app.analytics', expect.objectContaining({ outcome: 'dropped' }));
  });

  test('keeps the tally when the server does not answer with a 2xx', async () => {
    // Arrange
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));
    vi.mocked(sendEvents).mockResolvedValue({ ok: false, status: 503 });

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    await expect(remainingDays()).resolves.toEqual(['2026-10-22']);
    expect(logger.warn).toHaveBeenCalledWith('app.analytics', { outcome: 'failed', events: 1, status: 503 });
  });

  test('keeps the tally when the request fails before an answer', async () => {
    // Arrange
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));
    vi.mocked(sendEvents).mockResolvedValue({ ok: false });

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    await expect(remainingDays()).resolves.toEqual(['2026-10-22']);
    expect(logger.warn).toHaveBeenCalledWith('app.analytics', { outcome: 'failed', events: 1 });
  });

  test('keeps today for tomorrow', async () => {
    // Arrange
    await incrementCounter('articles_opened', now);

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();
    await expect(remainingDays()).resolves.toEqual(['2026-10-23']);
  });

  test('sends today when asked to', async () => {
    // Arrange
    await incrementCounter('articles_opened', now);

    // Act
    await flushUsageAnalytics({ now, includeToday: true });

    // Assert
    expect(sendEvents).toHaveBeenCalledOnce();
    await expect(remainingDays()).resolves.toEqual([]);
  });

  test('uses the current time for a day whose end is 25 hours old', async () => {
    // Arrange
    await incrementCounter('searches', new Date('2026-10-21T09:00:00Z'));
    const later = new Date('2026-10-23T00:59:59.999Z');

    // Act
    await flushUsageAnalytics({ now: later });

    // Assert
    expect(sendEvents).toHaveBeenCalledWith(endpoint, [expect.objectContaining({ timestamp: later.toISOString() })]);
  });

  test('drops a day older than 7 days without sending it, and sends a day that is exactly 7 days old', async () => {
    // Arrange
    await incrementCounter('searches', new Date('2026-10-15T09:00:00Z'));
    await incrementCounter('searches', new Date('2026-10-16T09:00:00Z'));

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    expect(sendEvents).toHaveBeenCalledWith(endpoint, [expect.objectContaining({ props: expect.objectContaining({ day: '2026-10-16' }) })]);
    await expect(remainingDays()).resolves.toEqual([]);
    expect(logger.info).toHaveBeenCalledWith('app.analytics', { outcome: 'dropped', events: 1 });
  });

  test('sends nothing without consent', async () => {
    // Arrange
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));
    setCountingEnabled(false);

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();
  });

  test('sends nothing when the build has no endpoint', async () => {
    // Arrange
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));
    vi.mocked(getAnalyticsEndpoint).mockReturnValue({ name: 'DISABLED', reason: 'NO_KEY' });

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();
    await expect(remainingDays()).resolves.toEqual(['2026-10-22']);
  });

  test('does not send when consent is withdrawn while the summary is built', async () => {
    // Arrange
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));
    vi.mocked(getAnalyticsEndpoint).mockImplementation(() => {
      queueMicrotask(() => setCountingEnabled(false));
      return endpoint;
    });

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();
  });

  test('does not start a second flush while one runs', async () => {
    // Arrange
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));
    let release: () => void = () => undefined;
    vi.mocked(sendEvents).mockReturnValue(new Promise((resolve) => {
      release = () => resolve({ ok: true });
    }));

    // Act
    const first = flushUsageAnalytics({ now });
    await vi.waitFor(() => expect(sendEvents).toHaveBeenCalledOnce());
    await flushUsageAnalytics({ now });
    release();
    await first;

    // Assert
    expect(sendEvents).toHaveBeenCalledOnce();
  });

  test('logs and recovers when reading the tallies fails', async () => {
    // Arrange
    vi.mocked(sendEvents).mockRejectedValue(new Error('boom'));
    await incrementCounter('articles_opened', new Date('2026-10-22T09:00:00Z'));

    // Act
    await flushUsageAnalytics({ now });

    // Assert
    expect(logger.warn).toHaveBeenCalledWith('app.analytics', { outcome: 'failed', events: 0 }, expect.any(Error));
    await expect(remainingDays()).resolves.toEqual(['2026-10-22']);
  });
});

describe('sendConsentGranted', () => {
  test('sends one event with no props', async () => {
    // Act
    await sendConsentGranted(now);

    // Assert
    expect(sendEvents).toHaveBeenCalledExactlyOnceWith(endpoint, [{ timestamp: now.toISOString(), eventName: 'consent_granted' }]);
    expect(logger.info).toHaveBeenCalledWith('app.analytics', { outcome: 'sent', events: 1 });
  });

  test('logs a failure', async () => {
    // Arrange
    vi.mocked(sendEvents).mockResolvedValue({ ok: false, status: 500 });

    // Act
    await sendConsentGranted(now);

    // Assert
    expect(logger.warn).toHaveBeenCalledWith('app.analytics', { outcome: 'failed', events: 1, status: 500 });
  });

  test('sends nothing without an endpoint', async () => {
    // Arrange
    vi.mocked(getAnalyticsEndpoint).mockReturnValue({ name: 'DISABLED', reason: 'DEVELOPMENT' });

    // Act
    await sendConsentGranted(now);

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();
  });
});

describe('startUsageAnalytics', () => {
  const stopObserving = vi.fn();

  beforeEach(async () => {
    vi.useFakeTimers({ now });
    vi.mocked(observeLogs).mockReturnValue(stopObserving);
    await db.deleteFrom('setting').execute();
    setCountingEnabled(false);
  });

  afterEach(() => {
    stopUsageAnalytics();
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  test('turns counting on for a stored grant and counts the launch', async () => {
    // Arrange
    await setUsageAnalyticsConsent('granted', 'v1', now);

    // Act
    await startUsageAnalytics();

    // Assert
    expect(isCountingEnabled()).toBe(true);
    expect((await getUsageAnalyticsPromptHistory()).launchCount).toBe(1);
  });

  test('leaves counting off without a grant', async () => {
    // Act
    await startUsageAnalytics();

    // Assert
    expect(isCountingEnabled()).toBe(false);
  });

  test('sends the finished days 60 seconds after launch, then every hour', async () => {
    // Arrange
    await setUsageAnalyticsConsent('granted', 'v1', now);
    setCountingEnabled(true);
    await incrementCounter('searches', new Date('2026-10-22T09:00:00Z'));
    await startUsageAnalytics();

    // Act
    await vi.advanceTimersByTimeAsync(30_000);

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();

    // Act
    await vi.advanceTimersByTimeAsync(40_000);

    // Assert
    await vi.waitFor(() => expect(sendEvents).toHaveBeenCalledOnce());

    // Arrange
    setCountingEnabled(true);
    await incrementCounter('searches', new Date('2026-10-22T09:00:00Z'));

    // Act
    await vi.advanceTimersByTimeAsync(1_800_000);

    // Assert
    expect(sendEvents).toHaveBeenCalledOnce();

    // Act
    await vi.advanceTimersByTimeAsync(1_900_000);

    // Assert
    await vi.waitFor(() => expect(sendEvents).toHaveBeenCalledTimes(2));
  });

  test('stops sending after stopUsageAnalytics', async () => {
    // Arrange
    await setUsageAnalyticsConsent('granted', 'v1', now);
    setCountingEnabled(true);
    await incrementCounter('searches', new Date('2026-10-22T09:00:00Z'));
    await startUsageAnalytics();

    // Act
    stopUsageAnalytics();
    await vi.advanceTimersByTimeAsync(7_200_000);

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();
    expect(stopObserving).toHaveBeenCalledOnce();
  });

  test('an end-to-end run can shorten the timer and send today', async () => {
    // Arrange
    vi.stubEnv('E2E_TEST', '1');
    vi.stubEnv('MONFIL_ANALYTICS_FLUSH_MS', '200');
    await setUsageAnalyticsConsent('granted', 'v1', now);
    setCountingEnabled(true);
    await incrementCounter('searches', now);
    await startUsageAnalytics();

    // Act
    await vi.advanceTimersByTimeAsync(200);

    // Assert
    await vi.waitFor(() => expect(sendEvents).toHaveBeenCalledOnce());
  });

  test.each([['0', true], ['abc', true], ['200', false]])('ignores MONFIL_ANALYTICS_FLUSH_MS=%s (end-to-end run: %s)', async (flush, e2e) => {
    // Arrange
    vi.stubEnv('E2E_TEST', e2e ? '1' : '');
    vi.stubEnv('MONFIL_ANALYTICS_FLUSH_MS', flush);
    await setUsageAnalyticsConsent('granted', 'v1', now);
    setCountingEnabled(true);
    await incrementCounter('searches', now);
    await startUsageAnalytics();

    // Act
    await vi.advanceTimersByTimeAsync(1000);

    // Assert
    expect(sendEvents).not.toHaveBeenCalled();
  });
});
