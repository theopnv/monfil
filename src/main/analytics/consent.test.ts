// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, beforeEach, describe, expect, test, vi } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { addFeedToDatabase } from '../db/crud/insert';
import { getUsageAnalyticsConsent, recordAppLaunch } from '../app/settings';
import { incrementCounter, isCountingEnabled, listDays, setCountingEnabled } from './counters';
import { changeUsageAnalyticsConsent, dismissUsageAnalyticsPrompt, getUsageAnalyticsState, loadUsageAnalyticsConsent, shouldPromptForUsageAnalytics, type PromptInput } from './consent';
import { getAnalyticsEndpoint } from './config';
import { sendConsentGranted } from './scheduler';
import { HOME_WORKSPACE_ID } from '../../shared/contracts';

vi.mock(import('./config'), () => ({ getAnalyticsEndpoint: vi.fn() }));
vi.mock(import('./scheduler'), () => ({ sendConsentGranted: vi.fn(), flushUsageAnalytics: vi.fn(), startUsageAnalytics: vi.fn(), stopUsageAnalytics: vi.fn(), summaryTimestamp: vi.fn() }));
vi.mock(import('../logging/logger'), () => ({ logger: { warn: vi.fn(), info: vi.fn(), error: vi.fn(), debug: vi.fn(), child: vi.fn() } }));

const now = new Date('2026-10-23T08:00:00Z');
const eligible: PromptInput = { consent: 'unset', feedCount: 1, launchCount: 2, promptCount: 0, lastShownAt: undefined, now };

describe('shouldPromptForUsageAnalytics', () => {
  test('shows for an undecided user with a feed and two launches', () => {
    // Act, Assert
    expect(shouldPromptForUsageAnalytics(eligible)).toBe(true);
  });

  test.each([
    ['has decided', { consent: 'granted' as const }],
    ['has denied', { consent: 'denied' as const }],
    ['has no feed', { feedCount: 0 }],
    ['launched once', { launchCount: 1 }],
    ['saw the card twice', { promptCount: 2 }],
    ['saw the card 13 days ago', { promptCount: 1, lastShownAt: new Date('2026-10-10T08:00:01Z') }],
  ])('hides when the user %s', (_label, change) => {
    // Act, Assert
    expect(shouldPromptForUsageAnalytics({ ...eligible, ...change })).toBe(false);
  });

  test('shows again after 14 days, once', () => {
    // Act, Assert
    expect(shouldPromptForUsageAnalytics({ ...eligible, promptCount: 1, lastShownAt: new Date('2026-10-09T08:00:00Z') })).toBe(true);
  });
});

describe('usage analytics state', () => {
  beforeAll(async () => {
    await initializeDatabase(':memory:');
  });

  beforeEach(() => {
    vi.stubEnv('MONFIL_HINTS', undefined);
    vi.mocked(getAnalyticsEndpoint).mockReturnValue({ name: 'ENABLED', url: 'https://x/api/v0/events', key: 'A-EU-1' });
    setCountingEnabled(false);
  });

  afterEach(async () => {
    await db.deleteFrom('setting').execute();
    await db.deleteFrom('usage_counter').execute();
    await db.deleteFrom('feedMetadata').execute();
    vi.unstubAllEnvs();
  });

  async function addFeed() {
    await addFeedToDatabase({ workspaceId: HOME_WORKSPACE_ID, link: 'https://example.com/feed', title: 'Feed', type: 'rss', categoryName: 'Tech', showInWorkspace: true, items: [] });
  }

  test('is unset and not prompting for a new profile', async () => {
    // Act, Assert
    await expect(getUsageAnalyticsState(now)).resolves.toEqual({ consent: 'unset', shouldPrompt: false, available: true });
  });

  test('prompts after a feed and two launches', async () => {
    // Arrange
    await addFeed();
    await recordAppLaunch();
    await recordAppLaunch();

    // Act, Assert
    await expect(getUsageAnalyticsState(now)).resolves.toEqual({ consent: 'unset', shouldPrompt: true, available: true });
  });

  test('does not prompt in a build without an endpoint', async () => {
    // Arrange
    await addFeed();
    await recordAppLaunch();
    await recordAppLaunch();
    vi.mocked(getAnalyticsEndpoint).mockReturnValue({ name: 'DISABLED', reason: 'NO_KEY' });

    // Act, Assert
    await expect(getUsageAnalyticsState(now)).resolves.toEqual({ consent: 'unset', shouldPrompt: false, available: false });
  });

  test('does not prompt when hints are off', async () => {
    // Arrange
    await addFeed();
    await recordAppLaunch();
    await recordAppLaunch();
    vi.stubEnv('MONFIL_HINTS', 'off');

    // Act
    const state = await getUsageAnalyticsState(now);

    // Assert
    expect(state.shouldPrompt).toBe(false);
  });

  test('dismissing the card hides it for 14 days', async () => {
    // Arrange
    await addFeed();
    await recordAppLaunch();
    await recordAppLaunch();

    // Act
    const state = await dismissUsageAnalyticsPrompt(now);

    // Assert
    expect(state).toEqual({ consent: 'unset', shouldPrompt: false, available: true });
  });

  test('granting stores the choice, starts counting, and sends consent_granted once', async () => {
    // Act
    const state = await changeUsageAnalyticsConsent('granted', now);
    expect(sendConsentGranted).toHaveBeenCalledOnce();
    await changeUsageAnalyticsConsent('granted', now);

    // Assert
    expect(state.consent).toBe('granted');
    expect(isCountingEnabled()).toBe(true);
    await expect(getUsageAnalyticsConsent()).resolves.toBe('granted');
    expect(sendConsentGranted).toHaveBeenCalledOnce();
    const rows = await db.selectFrom('setting').selectAll().execute();
    expect(rows).toEqual(expect.arrayContaining([
      { key: 'usageAnalyticsConsentAt', value: now.toISOString() },
      { key: 'usageAnalyticsNoticeVersion', value: '2026-10-23' },
    ]));
  });

  test('withdrawing stops counting at once and deletes every tally', async () => {
    // Arrange
    await changeUsageAnalyticsConsent('granted', now);
    await incrementCounter('articles_opened', now);

    // Act
    const state = await changeUsageAnalyticsConsent('denied', now);
    await incrementCounter('articles_opened', now);

    // Assert
    expect(state.consent).toBe('denied');
    expect(isCountingEnabled()).toBe(false);
    await expect(listDays()).resolves.toEqual([]);
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
});
