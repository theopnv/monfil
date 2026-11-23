// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { db } from '../db/database';
import { getUsageAnalyticsConsent, getUsageAnalyticsPromptHistory } from '../app/settings';
import { incrementCounter, isCountingEnabled, listDays, setCountingEnabled } from './counters';
import { changeUsageAnalyticsConsent, dismissUsageAnalyticsPrompt, getUsageAnalyticsState, loadUsageAnalyticsConsent, shouldPromptForUsageAnalytics, type PromptInput } from './consent';
import { getAnalyticsEndpoint } from './config';
import { sendConsentGranted } from './scheduler';
import { getSentryEndpoint } from '../observability/config';
import { startObservability, stopObservability } from '../observability/sentry';
import { useTestDatabase } from '../test/db';

vi.mock(import('./config'), () => ({ getAnalyticsEndpoint: vi.fn() }));
vi.mock(import('../observability/config'), () => ({ getSentryEndpoint: vi.fn() }));
vi.mock(import('../observability/sentry'), () => ({ startObservability: vi.fn(), stopObservability: vi.fn() }));
vi.mock(import('./scheduler'), () => ({ sendConsentGranted: vi.fn(), flushUsageAnalytics: vi.fn(), startUsageAnalytics: vi.fn(), stopUsageAnalytics: vi.fn(), summaryTimestamp: vi.fn() }));
vi.mock(import('../logging/logger'), () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() } }));

const now = new Date('2026-11-23T08:00:00Z');
const eligible: PromptInput = { consent: 'unset', lastShownAt: undefined, now };

describe('shouldPromptForUsageAnalytics', () => {
  test('shows at the first run, before any feed or second launch', () => {
    // Act, Assert
    expect(shouldPromptForUsageAnalytics(eligible)).toBe(true);
  });

  test('never shows to a user who agreed', () => {
    // Act, Assert
    expect(shouldPromptForUsageAnalytics({ ...eligible, consent: 'granted' })).toBe(false);
  });

  test.each([
    ['declined', 'denied' as const],
    ['has not decided', 'unset' as const],
  ])('hides for 30 days after the card was shown to a user who %s', (_label, consent) => {
    // Act, Assert
    expect(shouldPromptForUsageAnalytics({ ...eligible, consent, lastShownAt: new Date('2026-10-24T08:00:01Z') })).toBe(false);
  });

  test.each([
    ['declined', 'denied' as const],
    ['has not decided', 'unset' as const],
  ])('shows again after 30 days to a user who %s', (_label, consent) => {
    // Act, Assert
    expect(shouldPromptForUsageAnalytics({ ...eligible, consent, lastShownAt: new Date('2026-10-24T08:00:00Z') })).toBe(true);
  });

  test('has no limit on the number of times it shows', () => {
    // Arrange
    let shown = new Date('2026-01-01T08:00:00Z');
    const answers: boolean[] = [];

    // Act
    for (let month = 1; month <= 6; month += 1) {
      const later = new Date(shown.getTime() + 30 * 24 * 60 * 60 * 1000);
      answers.push(shouldPromptForUsageAnalytics({ consent: 'denied', lastShownAt: shown, now: later }));
      shown = later;
    }

    // Assert
    expect(answers).toEqual([true, true, true, true, true, true]);
  });
});

describe('usage analytics state', () => {
  useTestDatabase();

  beforeEach(() => {
    vi.stubEnv('MONFIL_HINTS', undefined);
    vi.mocked(getAnalyticsEndpoint).mockReturnValue({ name: 'ENABLED', url: 'https://x/api/v0/events', key: 'A-EU-1' });
    vi.mocked(getSentryEndpoint).mockReturnValue({ name: 'ENABLED', dsn: 'https://key@o1.ingest.de.sentry.io/2' });
    setCountingEnabled(false);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  test('prompts a new profile at the first run', async () => {
    // Act, Assert
    await expect(getUsageAnalyticsState(now)).resolves.toEqual({ consent: 'unset', shouldPrompt: true, available: true });
  });

  test.each([
    ['usage stats only', { name: 'ENABLED' as const, url: 'https://x/api/v0/events', key: 'A-EU-1' }, { name: 'DISABLED' as const, reason: 'NO_DSN' as const }],
    ['error reports only', { name: 'DISABLED' as const, reason: 'NO_KEY' as const }, { name: 'ENABLED' as const, dsn: 'https://key@o1.ingest.de.sentry.io/2' }],
  ])('is available in a build that has %s', async (_label, analytics, sentry) => {
    // Arrange
    vi.mocked(getAnalyticsEndpoint).mockReturnValue(analytics);
    vi.mocked(getSentryEndpoint).mockReturnValue(sentry);

    // Act, Assert
    await expect(getUsageAnalyticsState(now)).resolves.toMatchObject({ available: true, shouldPrompt: true });
  });

  test('does not prompt in a build without a usage stats endpoint and without a DSN', async () => {
    // Arrange
    vi.mocked(getAnalyticsEndpoint).mockReturnValue({ name: 'DISABLED', reason: 'NO_KEY' });
    vi.mocked(getSentryEndpoint).mockReturnValue({ name: 'DISABLED', reason: 'NO_DSN' });

    // Act, Assert
    await expect(getUsageAnalyticsState(now)).resolves.toEqual({ consent: 'unset', shouldPrompt: false, available: false });
  });

  test('does not prompt when hints are off', async () => {
    // Arrange
    vi.stubEnv('MONFIL_HINTS', 'off');

    // Act
    const state = await getUsageAnalyticsState(now);

    // Assert
    expect(state.shouldPrompt).toBe(false);
  });

  test('dismissing the card hides it for 30 days and asks again on the 30th day', async () => {
    // Act
    const dismissed = await dismissUsageAnalyticsPrompt(now);
    const later = await getUsageAnalyticsState(new Date('2026-12-22T08:00:00Z'));
    const asksAgain = await getUsageAnalyticsState(new Date('2026-12-23T08:00:00Z'));

    // Assert
    expect(dismissed).toEqual({ consent: 'unset', shouldPrompt: false, available: true });
    expect(later.shouldPrompt).toBe(false);
    expect(asksAgain.shouldPrompt).toBe(true);
  });

  test('granting stores the choice, starts counting and error reports, and sends consent_granted once', async () => {
    // Act
    const state = await changeUsageAnalyticsConsent('granted', now);
    expect(sendConsentGranted).toHaveBeenCalledOnce();
    await changeUsageAnalyticsConsent('granted', now);

    // Assert
    expect(state).toEqual({ consent: 'granted', shouldPrompt: false, available: true });
    expect(isCountingEnabled()).toBe(true);
    await expect(getUsageAnalyticsConsent()).resolves.toBe('granted');
    expect(sendConsentGranted).toHaveBeenCalledOnce();
    expect(startObservability).toHaveBeenCalledOnce();
    const rows = await db.selectFrom('setting').selectAll().execute();
    expect(rows).toEqual(expect.arrayContaining([
      { key: 'usageAnalyticsConsentAt', value: now.toISOString() },
      { key: 'usageAnalyticsNoticeVersion', value: '2026-11-23' },
    ]));
  });

  test('withdrawing stops counting and error reports at once and deletes every tally', async () => {
    // Arrange
    await changeUsageAnalyticsConsent('granted', now);
    await incrementCounter('articles_opened', now);

    // Act
    const state = await changeUsageAnalyticsConsent('denied', now);
    await incrementCounter('articles_opened', now);

    // Assert
    expect(state.consent).toBe('denied');
    expect(isCountingEnabled()).toBe(false);
    expect(stopObservability).toHaveBeenCalledOnce();
    await expect(listDays()).resolves.toEqual([]);
  });

  test('error reports stop before the choice returns', async () => {
    // Arrange
    let stopped = false;
    vi.mocked(stopObservability).mockImplementation(async () => {
      await Promise.resolve();
      stopped = true;
    });

    // Act
    await changeUsageAnalyticsConsent('denied', now);

    // Assert
    expect(stopped).toBe(true);
  });

  test('starts no error reports when the choice is denied', async () => {
    // Act
    await changeUsageAnalyticsConsent('denied', now);

    // Assert
    expect(startObservability).not.toHaveBeenCalled();
    expect(sendConsentGranted).not.toHaveBeenCalled();
  });

  test.each([['granted' as const], ['denied' as const]])('answering %s hides the card for 30 days', async (choice) => {
    // Act
    await changeUsageAnalyticsConsent(choice, now);

    // Assert
    await expect(getUsageAnalyticsPromptHistory()).resolves.toEqual({ lastShownAt: now });
  });

  test('loads a stored grant into the counters at startup', async () => {
    // Arrange
    await changeUsageAnalyticsConsent('granted', now);
    setCountingEnabled(false);

    // Act
    await loadUsageAnalyticsConsent();

    // Assert
    expect(isCountingEnabled()).toBe(true);
  });

  test('keeps counting off at startup when the user has not decided', async () => {
    // Arrange
    setCountingEnabled(true);

    // Act
    await loadUsageAnalyticsConsent();

    // Assert
    expect(isCountingEnabled()).toBe(false);
  });

  test('keeps counting off at startup when the user denied', async () => {
    // Arrange
    await changeUsageAnalyticsConsent('denied', now);
    setCountingEnabled(true);

    // Act
    await loadUsageAnalyticsConsent();

    // Assert
    expect(isCountingEnabled()).toBe(false);
  });

  test('does not prompt a user who agreed', async () => {
    // Arrange
    await changeUsageAnalyticsConsent('granted', now);

    // Act
    const state = await getUsageAnalyticsState(new Date('2027-06-01T08:00:00Z'));

    // Assert
    expect(state).toEqual({ consent: 'granted', shouldPrompt: false, available: true });
  });

  test('asks a user who declined again 30 days later', async () => {
    // Arrange
    await changeUsageAnalyticsConsent('denied', now);

    // Act
    const early = await getUsageAnalyticsState(new Date('2026-12-22T08:00:00Z'));
    const due = await getUsageAnalyticsState(new Date('2026-12-23T08:00:00Z'));

    // Assert
    expect(early).toEqual({ consent: 'denied', shouldPrompt: false, available: true });
    expect(due).toEqual({ consent: 'denied', shouldPrompt: true, available: true });
  });
});
