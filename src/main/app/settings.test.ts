// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeAll, describe, expect, test } from 'vitest';
import { db, initializeDatabase } from '../db/database';
import {
  DEFAULT_DETAILED_LOGGING, DEFAULT_REFRESH_INTERVAL, DEFAULT_REFRESH_ON_LAUNCH, DEFAULT_RETENTION_DAYS, getDetailedLogging, getRefreshInterval, getRefreshOnLaunch, getRetentionDays,
  setDetailedLogging, setRefreshInterval, setRefreshOnLaunch, setRetentionDays, toRefreshInterval, toRefreshOnLaunch, toRetentionDays,
  getUsageAnalyticsConsent, getUsageAnalyticsPromptHistory, recordAppLaunch, recordUsageAnalyticsPromptDismissed, setUsageAnalyticsConsent, toUsageAnalyticsConsent,
} from './settings';

beforeAll(async () => {
  await initializeDatabase(':memory:');
});

afterEach(async () => {
  await db.deleteFrom('setting').execute();
});

describe('toRefreshInterval', () => {
  test.each([
    [15, 15], [30, 30], [60, 60], [360, 360], ['manual', 'manual'], ['15', 15], ['360', 360],
  ])('keeps the supported value %j as %j', (value, expected) => {
    // Act & Assert
    expect(toRefreshInterval(value)).toBe(expected);
  });

  test.each([
    [7], ['7'], ['soon'], [''], [null], [undefined], [true], [[60]], [{}], [['manual']],
  ])('gives the default for the value %j that is not a supported interval', (value) => {
    // Act & Assert
    expect(toRefreshInterval(value)).toBe(DEFAULT_REFRESH_INTERVAL);
  });
});

describe('getRefreshInterval', () => {
  test('reads a stored number of minutes', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshIntervalMinutes', value: '15' }).execute();

    // Act & Assert
    expect(await getRefreshInterval()).toBe(15);
  });

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

describe('toRefreshOnLaunch', () => {
  test.each([
    ['true', true], [true, true], ['false', false], [false, false],
  ])('reads %j as %j', (value, expected) => {
    // Act & Assert
    expect(toRefreshOnLaunch(value)).toBe(expected);
  });

  test.each([
    ['yes'], [''], [1], [0], [null], [undefined], ['TRUE'],
  ])('gives the default for the value %j that is not a boolean', (value) => {
    // Act & Assert
    expect(toRefreshOnLaunch(value)).toBe(DEFAULT_REFRESH_ON_LAUNCH);
  });
});

describe('getRefreshOnLaunch', () => {
  test('reads a stored false', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'refreshOnLaunch', value: 'false' }).execute();

    // Act & Assert
    expect(await getRefreshOnLaunch()).toBe(false);
  });

  test('ignores the other settings rows', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'somethingElse', value: 'false' }).execute();

    // Act & Assert
    expect(await getRefreshOnLaunch()).toBe(DEFAULT_REFRESH_ON_LAUNCH);
  });

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

describe('toRetentionDays', () => {
  test.each([
    [15, 15], [30, 30], [60, 60], [90, 90], [180, 180], ['15', 15], ['180', 180],
  ])('keeps the supported value %j as %j', (value, expected) => {
    // Act & Assert
    expect(toRetentionDays(value)).toBe(expected);
  });

  test.each([
    [7], ['7'], ['forever'], [''], [null], [undefined], [[90]], [{}], [true],
  ])('gives the default for the value %j that is not a supported number of days', (value) => {
    // Act & Assert
    expect(toRetentionDays(value)).toBe(DEFAULT_RETENTION_DAYS);
  });
});

describe('getRetentionDays', () => {
  test('falls back to the default when nothing is stored', async () => {
    // Act & Assert
    expect(await getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
  });

  test('reads the stored number of days and ignores the other settings rows', async () => {
    // Arrange
    await db.insertInto('setting').values([{ key: 'somethingElse', value: '15' }, { key: 'retentionDays', value: '90' }]).execute();

    // Act & Assert
    expect(await getRetentionDays()).toBe(90);
  });

  test('falls back to the default when the stored value is not a supported one', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'retentionDays', value: '45' }).execute();

    // Act & Assert
    expect(await getRetentionDays()).toBe(DEFAULT_RETENTION_DAYS);
  });
});

describe('setRetentionDays', () => {
  test('stores the days and reads them back, replacing the previous choice', async () => {
    // Act
    await setRetentionDays(180);
    await setRetentionDays(60);

    // Assert
    expect(await getRetentionDays()).toBe(60);
    expect(await db.selectFrom('setting').selectAll().execute()).toEqual([{ key: 'retentionDays', value: '60' }]);
  });

  test('stores the default for an unsupported number of days', async () => {
    // Act
    await setRetentionDays(7 as never);

    // Assert
    expect(await db.selectFrom('setting').selectAll().execute()).toEqual([{ key: 'retentionDays', value: String(DEFAULT_RETENTION_DAYS) }]);
  });
});

describe('getDetailedLogging', () => {
  test('is off when nothing is stored', async () => {
    // Act & Assert
    expect(await getDetailedLogging()).toBe(DEFAULT_DETAILED_LOGGING);
  });

  test.each([['true', true], ['false', false]])('reads the stored text %j as %j', async (stored, expected) => {
    // Arrange
    await db.insertInto('setting').values({ key: 'detailedLogging', value: stored }).execute();

    // Act & Assert
    expect(await getDetailedLogging()).toBe(expected);
  });

  test('ignores the other settings rows', async () => {
    // Arrange
    await db.insertInto('setting').values({ key: 'somethingElse', value: 'true' }).execute();

    // Act & Assert
    expect(await getDetailedLogging()).toBe(DEFAULT_DETAILED_LOGGING);
  });

  test.each(['yes', '', 'TRUE', '1'])('stays off for the stored text %j, which is not a boolean', async (stored) => {
    // Arrange
    await db.insertInto('setting').values({ key: 'detailedLogging', value: stored }).execute();

    // Act & Assert
    expect(await getDetailedLogging()).toBe(false);
  });
});

describe('setDetailedLogging', () => {
  test.each([true, false])('stores %j and reads it back', async (value) => {
    // Act
    await setDetailedLogging(value);

    // Assert
    expect(await getDetailedLogging()).toBe(value);
  });

  test('overwrites the previous choice instead of adding a row', async () => {
    // Act
    await setDetailedLogging(true);
    await setDetailedLogging(false);

    // Assert
    expect(await db.selectFrom('setting').selectAll().execute()).toEqual([{ key: 'detailedLogging', value: 'false' }]);
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
