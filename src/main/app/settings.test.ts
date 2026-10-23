// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import { DEFAULT_REFRESH_INTERVAL, DEFAULT_REFRESH_ON_LAUNCH, getRefreshInterval, getRefreshOnLaunch, setRefreshInterval, setRefreshOnLaunch, getUsageAnalyticsConsent, getUsageAnalyticsPromptHistory, recordAppLaunch, recordUsageAnalyticsPromptDismissed, setUsageAnalyticsConsent, toUsageAnalyticsConsent } from './settings';

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('setting').execute();
});

describe('getRefreshInterval', () => {
  test('falls back to the default when nothing is stored', async () => {
    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('falls back to the default when the stored value is not a supported one', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshIntervalMinutes', value: 'every other tuesday' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('falls back to the default when the stored value is empty', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshIntervalMinutes', value: '' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('falls back to the default when the stored number is not one of the choices', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshIntervalMinutes', value: '7' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });

  test('ignores the other settings rows', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'somethingElse', value: '15' }).execute();

    // Act
    const interval = await getRefreshInterval();

    // Assert
    expect(interval).toBe(DEFAULT_REFRESH_INTERVAL);
  });
});

describe('setRefreshInterval', () => {
  test('stores a number of minutes and reads it back', async () => {
    // Act
    await setRefreshInterval(360);

    // Assert
    expect(await getRefreshInterval()).toBe(360);
  });

  test("stores 'manual' and reads it back", async () => {
    // Act
    await setRefreshInterval('manual');

    // Assert
    expect(await getRefreshInterval()).toBe('manual');
  });

  test('overwrites the previous choice instead of adding a row', async () => {
    // Act
    await setRefreshInterval(15);
    await setRefreshInterval('manual');

    // Assert
    expect(await getRefreshInterval()).toBe('manual');
    const rows = await db.selectFrom('setting').selectAll().execute();
    expect(rows).toHaveLength(1);
  });
});

describe('getRefreshOnLaunch', () => {
  test('falls back to the default when nothing is stored', async () => {
    // Act
    const value = await getRefreshOnLaunch();

    // Assert
    expect(value).toBe(DEFAULT_REFRESH_ON_LAUNCH);
  });

  test('falls back to the default when the stored value is garbage', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshOnLaunch', value: 'not-a-boolean' }).execute();

    // Act
    const value = await getRefreshOnLaunch();

    // Assert
    expect(value).toBe(DEFAULT_REFRESH_ON_LAUNCH);
  });
});

describe('setRefreshOnLaunch', () => {
  test('stores false and reads it back', async () => {
    // Act
    await setRefreshOnLaunch(false);

    // Assert
    expect(await getRefreshOnLaunch()).toBe(false);
  });

  test('stores true and reads it back', async () => {
    // Act
    await setRefreshOnLaunch(true);

    // Assert
    expect(await getRefreshOnLaunch()).toBe(true);
  });

  test('overwrites the previous choice instead of adding a row', async () => {
    // Act
    await setRefreshOnLaunch(false);
    await setRefreshOnLaunch(true);

    // Assert
    expect(await getRefreshOnLaunch()).toBe(true);
    const rows = await db.selectFrom('setting').selectAll().execute();
    expect(rows).toHaveLength(1);
  });
});

describe('usage analytics settings', () => {
  test('consent is unset by default and narrows odd values to unset', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'usageAnalyticsConsent', value: 'maybe' }).execute();

    // Act, Assert
    expect(await getUsageAnalyticsConsent()).toBe('unset');
    expect(toUsageAnalyticsConsent('granted')).toBe('granted');
    expect(toUsageAnalyticsConsent('denied')).toBe('denied');
    expect(toUsageAnalyticsConsent(undefined)).toBe('unset');
  });

  test('stores the choice with its date and notice version, replacing the previous one', async () => {
    // Act
    await setUsageAnalyticsConsent('granted', 'v1', new Date('2026-10-01T00:00:00Z'));
    await setUsageAnalyticsConsent('denied', 'v2', new Date('2026-10-02T00:00:00Z'));

    // Assert
    expect(await getUsageAnalyticsConsent()).toBe('denied');
    const rows = await db.selectFrom('setting').selectAll().orderBy('key').execute();
    expect(rows).toEqual([
      { key: 'usageAnalyticsConsent', value: 'denied' },
      { key: 'usageAnalyticsConsentAt', value: '2026-10-02T00:00:00.000Z' },
      { key: 'usageAnalyticsNoticeVersion', value: 'v2' },
    ]);
  });

  test('counts launches and dismissals of the card', async () => {
    // Arrange
    expect(await getUsageAnalyticsPromptHistory()).toEqual({ launchCount: 0, promptCount: 0, lastShownAt: undefined });

    // Act
    await recordAppLaunch();
    await recordAppLaunch();
    await recordUsageAnalyticsPromptDismissed(new Date('2026-10-02T00:00:00Z'));

    // Assert
    expect(await getUsageAnalyticsPromptHistory()).toEqual({ launchCount: 2, promptCount: 1, lastShownAt: new Date('2026-10-02T00:00:00Z') });
  });

  test('ignores damaged history values', async () => {
    // Arrange
    await db.insertInto('setting').values([
      { key: 'usageAnalyticsLaunchCount', value: '-3' },
      { key: 'usageAnalyticsPromptCount', value: 'many' },
      { key: 'usageAnalyticsPromptLastShownAt', value: 'yesterday' },
    ]).execute();

    // Act, Assert
    expect(await getUsageAnalyticsPromptHistory()).toEqual({ launchCount: 0, promptCount: 0, lastShownAt: undefined });
  });
});
