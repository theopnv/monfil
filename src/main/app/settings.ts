// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { db, dbReady } from '../db/database';
import { querySettings } from '../db/crud/query';
import type { RefreshInterval, RetentionDays, UsageAnalyticsConsent } from '../../shared/contracts';

export const REFRESH_INTERVALS: readonly RefreshInterval[] = [15, 30, 60, 360, 'manual'];

export const DEFAULT_REFRESH_INTERVAL: RefreshInterval = 30;

const REFRESH_INTERVAL_KEY = 'refreshIntervalMinutes';

/**
 * Narrows an untrusted value, such as a hand-edited database row or an IPC payload, to a supported interval.
 * @param value anything that is meant to be a refresh interval
 * @returns the matching interval, or `DEFAULT_REFRESH_INTERVAL` when there is no match
 */
export function toRefreshInterval(value: unknown): RefreshInterval {
  const candidate = typeof value === 'string' && value !== 'manual' ? Number(value) : value;
  return REFRESH_INTERVALS.includes(candidate as RefreshInterval)
    ? candidate as RefreshInterval
    : DEFAULT_REFRESH_INTERVAL;
}

/**
 * Reads how often the feeds are refreshed.
 * @returns the stored interval, or `DEFAULT_REFRESH_INTERVAL` when none is stored
 */
export async function getRefreshInterval(): Promise<RefreshInterval> {
  const [row] = await querySettings({ key: REFRESH_INTERVAL_KEY });
  return toRefreshInterval(row?.value);
}

/**
 * Stores how often the feeds are refreshed. The caller reschedules the timer.
 * @param value the interval to store
 */
export async function setRefreshInterval(value: RefreshInterval): Promise<void> {
  await dbReady;
  await db.insertInto('setting')
    .values({ key: REFRESH_INTERVAL_KEY, value: String(value) })
    .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
    .execute();
}

export const DEFAULT_REFRESH_ON_LAUNCH = true;

const REFRESH_ON_LAUNCH_KEY = 'refreshOnLaunch';

/**
 * Narrows an untrusted value, such as a hand-edited database row or an IPC payload, to a boolean.
 * @param value anything that is meant to be the refresh-on-launch preference
 * @returns the matching boolean, or `DEFAULT_REFRESH_ON_LAUNCH` when there is no match
 */
export function toRefreshOnLaunch(value: unknown): boolean {
  // Stryker disable next-line ConditionalExpression,StringLiteral,BlockStatement: DEFAULT_REFRESH_ON_LAUNCH is true, so dropping this branch returns the same value through the fallback
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return DEFAULT_REFRESH_ON_LAUNCH;
}

/**
 * Reads whether feeds refresh once at launch, in addition to the repeating timer.
 * @returns the stored preference, or `DEFAULT_REFRESH_ON_LAUNCH` when none is stored
 */
export async function getRefreshOnLaunch(): Promise<boolean> {
  const [row] = await querySettings({ key: REFRESH_ON_LAUNCH_KEY });
  return toRefreshOnLaunch(row?.value);
}

/**
 * Stores whether feeds refresh once at launch.
 * @param value the preference to store
 */
export async function setRefreshOnLaunch(value: boolean): Promise<void> {
  await dbReady;
  await db.insertInto('setting')
    .values({ key: REFRESH_ON_LAUNCH_KEY, value: String(value) })
    .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
    .execute();
}

export const RETENTION_OPTIONS: readonly RetentionDays[] = [15, 30, 60, 90, 180];
export const DEFAULT_RETENTION_DAYS: RetentionDays = 30;
const RETENTION_KEY = 'retentionDays';

export function toRetentionDays(value: unknown): RetentionDays {
  const candidate = typeof value === 'string' ? Number(value) : value;
  return RETENTION_OPTIONS.includes(candidate as RetentionDays) ? candidate as RetentionDays : DEFAULT_RETENTION_DAYS;
}

export async function getRetentionDays(): Promise<RetentionDays> {
  const [row] = await querySettings({ key: RETENTION_KEY });
  return toRetentionDays(row?.value);
}

export async function setRetentionDays(value: RetentionDays): Promise<void> {
  await dbReady;
  await db.insertInto('setting').values({ key: RETENTION_KEY, value: String(toRetentionDays(value)) })
    .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
    .execute();
}

export const DEFAULT_DETAILED_LOGGING = false;
const DETAILED_LOGGING_KEY = 'detailedLogging';

export async function getDetailedLogging(): Promise<boolean> {
  const [row] = await querySettings({ key: DETAILED_LOGGING_KEY });
  return toRefreshOnLaunch(row?.value ?? DEFAULT_DETAILED_LOGGING);
}

export async function setDetailedLogging(value: boolean): Promise<void> {
  await dbReady;
  await db.insertInto('setting')
    .values({ key: DETAILED_LOGGING_KEY, value: String(value) })
    .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
    .execute();
}

export const DEFAULT_USAGE_ANALYTICS_CONSENT: UsageAnalyticsConsent = 'unset';
const USAGE_ANALYTICS_CONSENT_KEY = 'usageAnalyticsConsent';
const USAGE_ANALYTICS_CONSENT_AT_KEY = 'usageAnalyticsConsentAt';
const USAGE_ANALYTICS_NOTICE_VERSION_KEY = 'usageAnalyticsNoticeVersion';
const USAGE_ANALYTICS_PROMPT_COUNT_KEY = 'usageAnalyticsPromptCount';
const USAGE_ANALYTICS_PROMPT_LAST_SHOWN_KEY = 'usageAnalyticsPromptLastShownAt';
const USAGE_ANALYTICS_LAUNCH_COUNT_KEY = 'usageAnalyticsLaunchCount';

async function writeSetting(key: string, value: string): Promise<void> {
  await dbReady;
  await db.insertInto('setting')
    .values({ key, value })
    .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
    .execute();
}

async function readCount(key: string): Promise<number> {
  const [row] = await querySettings({ key });
  const count = Number(row?.value);
  // Stryker disable next-line EqualityOperator: for a count of 0 both operators return 0, and a stored "-0" still behaves as 0 in every comparison and sum
  return Number.isSafeInteger(count) && count > 0 ? count : 0;
}

/**
 * Narrows an untrusted value, such as a hand-edited database row, to a consent state.
 * @param value anything that is meant to be a consent state
 * @returns the matching state, or `unset` when there is no match
 */
export function toUsageAnalyticsConsent(value: unknown): UsageAnalyticsConsent {
  return value === 'granted' || value === 'denied' ? value : DEFAULT_USAGE_ANALYTICS_CONSENT;
}

/** Reads whether the user agreed to share anonymous usage stats. */
export async function getUsageAnalyticsConsent(): Promise<UsageAnalyticsConsent> {
  const [row] = await querySettings({ key: USAGE_ANALYTICS_CONSENT_KEY });
  return toUsageAnalyticsConsent(row?.value);
}

/**
 * Stores the user's choice with the time it was made and the privacy notice version it was made under.
 * @param value the choice to store
 * @param noticeVersion the version of the privacy notice the user saw
 * @param now the time of the choice
 */
export async function setUsageAnalyticsConsent(value: UsageAnalyticsConsent, noticeVersion: string, now: Date): Promise<void> {
  await writeSetting(USAGE_ANALYTICS_CONSENT_KEY, value);
  await writeSetting(USAGE_ANALYTICS_CONSENT_AT_KEY, now.toISOString());
  await writeSetting(USAGE_ANALYTICS_NOTICE_VERSION_KEY, noticeVersion);
}

export interface UsageAnalyticsPromptHistory {
  launchCount: number;
  promptCount: number;
  lastShownAt: Date | undefined;
}

/** Reads how often the app launched and how often the consent card was put off. */
export async function getUsageAnalyticsPromptHistory(): Promise<UsageAnalyticsPromptHistory> {
  const [launchCount, promptCount, [lastShown]] = await Promise.all([
    readCount(USAGE_ANALYTICS_LAUNCH_COUNT_KEY),
    readCount(USAGE_ANALYTICS_PROMPT_COUNT_KEY),
    querySettings({ key: USAGE_ANALYTICS_PROMPT_LAST_SHOWN_KEY }),
  ]);
  const lastShownAt = lastShown ? new Date(lastShown.value) : undefined;
  return { launchCount, promptCount, lastShownAt: lastShownAt && !Number.isNaN(lastShownAt.getTime()) ? lastShownAt : undefined };
}

/** Counts one launch of the app. */
export async function recordAppLaunch(): Promise<void> {
  await writeSetting(USAGE_ANALYTICS_LAUNCH_COUNT_KEY, String(await readCount(USAGE_ANALYTICS_LAUNCH_COUNT_KEY) + 1));
}

/**
 * Counts one time the user put the consent card off.
 * @param now the time the card was put off
 */
export async function recordUsageAnalyticsPromptDismissed(now: Date): Promise<void> {
  await writeSetting(USAGE_ANALYTICS_PROMPT_COUNT_KEY, String(await readCount(USAGE_ANALYTICS_PROMPT_COUNT_KEY) + 1));
  await writeSetting(USAGE_ANALYTICS_PROMPT_LAST_SHOWN_KEY, now.toISOString());
}
