// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { db, dbReady } from '../db/database';
import { querySettings } from '../db/crud/query';
import { REFRESH_INTERVALS, RETENTION_OPTIONS, type RefreshInterval, type RetentionDays, type UsageAnalyticsConsent } from '../../shared/contracts';
import { isLanguageSetting, type LanguageSetting } from '../../shared/i18n/languages';

async function writeSetting(key: string, value: string): Promise<void> {
  await dbReady;
  await db.insertInto('setting')
    .values({ key, value })
    .onConflict((oc) => oc.column('key').doUpdateSet((eb) => ({ value: eb.ref('excluded.value') })))
    .execute();
}

interface Setting<T> {
  read: () => Promise<T>;
  write: (value: T) => Promise<void>;
}

/** `parse` narrows what is stored, so it must return the default for anything it does not know. */
function defineSetting<T>(key: string, parse: (value: unknown) => T, serialize: (value: T) => string = String): Setting<T> {
  return {
    async read() {
      const [row] = await querySettings({ key });
      return parse(row?.value);
    },
    write: (value) => writeSetting(key, serialize(value)),
  };
}

function toBoolean(value: unknown, fallback: boolean): boolean {
  if (value === 'true' || value === true) {
    return true;
  }
  if (value === 'false' || value === false) {
    return false;
  }
  return fallback;
}

export const DEFAULT_REFRESH_INTERVAL: RefreshInterval = 30;

export function toRefreshInterval(value: unknown): RefreshInterval {
  const candidate = typeof value === 'string' && value !== 'manual' ? Number(value) : value;
  return (REFRESH_INTERVALS as readonly unknown[]).includes(candidate)
    ? candidate as RefreshInterval
    : DEFAULT_REFRESH_INTERVAL;
}

/** The caller reschedules the refresh timer after a write. */
const refreshInterval = defineSetting('refreshIntervalMinutes', toRefreshInterval);
export const getRefreshInterval = refreshInterval.read;
export const setRefreshInterval = refreshInterval.write;

export const DEFAULT_REFRESH_ON_LAUNCH = true;

export function toRefreshOnLaunch(value: unknown): boolean {
  return toBoolean(value, DEFAULT_REFRESH_ON_LAUNCH);
}

const refreshOnLaunch = defineSetting('refreshOnLaunch', toRefreshOnLaunch);
export const getRefreshOnLaunch = refreshOnLaunch.read;
export const setRefreshOnLaunch = refreshOnLaunch.write;

export const DEFAULT_RETENTION_DAYS: RetentionDays = 30;

export function toRetentionDays(value: unknown): RetentionDays {
  const candidate = typeof value === 'string' ? Number(value) : value;
  return (RETENTION_OPTIONS as readonly unknown[]).includes(candidate) ? candidate as RetentionDays : DEFAULT_RETENTION_DAYS;
}

const retentionDays = defineSetting('retentionDays', toRetentionDays, (value) => String(toRetentionDays(value)));
export const getRetentionDays = retentionDays.read;
export const setRetentionDays = retentionDays.write;

export const DEFAULT_DETAILED_LOGGING = false;

const detailedLogging = defineSetting('detailedLogging', (value) => toBoolean(value, DEFAULT_DETAILED_LOGGING));
export const getDetailedLogging = detailedLogging.read;
export const setDetailedLogging = detailedLogging.write;

export const DEFAULT_WORKSPACE_RAIL_EXPANDED = false;

const workspaceRailExpanded = defineSetting('workspaceRailExpanded', (value) => toBoolean(value, DEFAULT_WORKSPACE_RAIL_EXPANDED));
export const getWorkspaceRailExpanded = workspaceRailExpanded.read;
export const setWorkspaceRailExpanded = workspaceRailExpanded.write;

export const DEFAULT_LANGUAGE_SETTING: LanguageSetting = 'system';

export function toLanguageSetting(value: unknown): LanguageSetting {
  return isLanguageSetting(value) ? value : DEFAULT_LANGUAGE_SETTING;
}

const languageSetting = defineSetting('language', toLanguageSetting, toLanguageSetting);
export const getLanguageSetting = languageSetting.read;
export const setLanguageSetting = languageSetting.write;

export function toUsageAnalyticsConsent(value: unknown): UsageAnalyticsConsent {
  return value === 'granted' || value === 'denied' ? value : 'unset';
}

const usageAnalyticsConsent = defineSetting('usageAnalyticsConsent', toUsageAnalyticsConsent);
export const getUsageAnalyticsConsent = usageAnalyticsConsent.read;

const USAGE_ANALYTICS_CONSENT_AT_KEY = 'usageAnalyticsConsentAt';
const USAGE_ANALYTICS_NOTICE_VERSION_KEY = 'usageAnalyticsNoticeVersion';
const USAGE_ANALYTICS_PROMPT_LAST_SHOWN_KEY = 'usageAnalyticsPromptLastShownAt';
const ERROR_REPORT_CAPS_KEY = 'errorReportCaps';

export async function setUsageAnalyticsConsent(value: UsageAnalyticsConsent, noticeVersion: string, now: Date): Promise<void> {
  await usageAnalyticsConsent.write(value);
  await writeSetting(USAGE_ANALYTICS_CONSENT_AT_KEY, now.toISOString());
  await writeSetting(USAGE_ANALYTICS_NOTICE_VERSION_KEY, noticeVersion);
}

export interface UsageAnalyticsPromptHistory {
  lastShownAt: Date | undefined;
}

export async function getUsageAnalyticsPromptHistory(): Promise<UsageAnalyticsPromptHistory> {
  const [lastShown] = await querySettings({ key: USAGE_ANALYTICS_PROMPT_LAST_SHOWN_KEY });
  const lastShownAt = lastShown ? new Date(lastShown.value) : undefined;
  return { lastShownAt: lastShownAt && !Number.isNaN(lastShownAt.getTime()) ? lastShownAt : undefined };
}

/** Marks the moment the user last answered or closed the consent card. The next card waits 30 days from it. */
export async function recordUsageAnalyticsPromptShown(now: Date): Promise<void> {
  await writeSetting(USAGE_ANALYTICS_PROMPT_LAST_SHOWN_KEY, now.toISOString());
}

/** The day tallies that keep the error reports under their daily caps, as the JSON text that the caps module wrote. */
export async function getErrorReportCaps(): Promise<string | undefined> {
  const [row] = await querySettings({ key: ERROR_REPORT_CAPS_KEY });
  return row?.value;
}

export async function setErrorReportCaps(value: string): Promise<void> {
  await writeSetting(ERROR_REPORT_CAPS_KEY, value);
}
