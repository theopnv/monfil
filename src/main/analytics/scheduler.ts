// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { logger } from '../logging/logger';
import { getAnalyticsEndpoint } from './config';
import { sendEvents, type AnalyticsEvent } from './client';
import { deleteDays, isCountingEnabled, listDays, readDay, setCountingEnabled, utcDay } from './counters';
import { readLibraryState } from './library';
import { getPreferencesSnapshot } from './preferences';
import { startHealthCounters } from './health';
import { buildDailySummary } from './summary';
import { getUsageAnalyticsConsent, recordAppLaunch } from '../app/settings';

const DAY_MS = 24 * 60 * 60 * 1000;
const INITIAL_DELAY_MS = 60_000;
const INTERVAL_MS = 60 * 60 * 1000;
const MAX_AGE_DAYS = 7;

let initialTimer: NodeJS.Timeout | undefined;
let intervalTimer: NodeJS.Timeout | undefined;
let stopHealthCounters: (() => void) | undefined;
let flushing = false;

/**
 * Picks the timestamp of a day's summary. The server rejects a timestamp older than 24 hours or in the future,
 * so the end of the day is used while it is recent enough, and the current time after that.
 * @param day the day as `YYYY-MM-DD`
 * @param now the current time
 */
export function summaryTimestamp(day: string, now: Date): Date {
  const endOfDay = Date.parse(`${day}T23:59:59.999Z`);
  const candidate = Math.min(endOfDay, now.getTime());
  return new Date(now.getTime() - candidate < DAY_MS ? candidate : now.getTime());
}

export interface FlushOptions {
  now?: Date;
  /** Sends today's tally too. Only the end-to-end tests set it. */
  includeToday?: boolean;
}

/**
 * Sends one `daily_summary` for each finished day that still has a tally, then deletes those tallies once the
 * server answered with a 2xx. A tally older than 7 days is deleted without being sent. It does nothing without consent.
 */
export async function flushUsageAnalytics({ now = new Date(), includeToday = false }: FlushOptions = {}): Promise<void> {
  const endpoint = getAnalyticsEndpoint();
  if (flushing || endpoint.name !== 'ENABLED' || !isCountingEnabled()) {
    return;
  }
  flushing = true;
  try {
    const today = utcDay(now);
    const oldestKept = utcDay(new Date(now.getTime() - MAX_AGE_DAYS * DAY_MS));
    const days = await listDays();
    const expired = days.filter((day) => day < oldestKept);
    if (expired.length > 0) {
      await deleteDays(expired);
      logger.info('app.analytics', { outcome: 'dropped', events: expired.length });
    }
    const pending = days.filter((day) => day >= oldestKept && (includeToday || day < today));
    if (pending.length === 0) {
      return;
    }
    const library = await readLibraryState();
    const preferences = getPreferencesSnapshot();
    const events: AnalyticsEvent[] = [];
    for (const day of pending) {
      events.push({
        timestamp: summaryTimestamp(day, now).toISOString(),
        eventName: 'daily_summary',
        props: buildDailySummary({ day, counters: await readDay(day), library, preferences }),
      });
    }
    if (!isCountingEnabled()) {
      return;
    }
    const outcome = await sendEvents(endpoint, events);
    if (outcome.ok) {
      await deleteDays(pending);
      logger.info('app.analytics', { outcome: 'sent', events: events.length });
    } else {
      logger.warn('app.analytics', { outcome: 'failed', events: events.length, ...(outcome.status === undefined ? {} : { status: outcome.status }) });
    }
  } catch (error) {
    logger.warn('app.analytics', { outcome: 'failed', events: 0 }, error);
  } finally {
    flushing = false;
  }
}

/** Tells the server that the user opted in. It carries no props. */
export async function sendConsentGranted(now = new Date()): Promise<void> {
  const endpoint = getAnalyticsEndpoint();
  if (endpoint.name !== 'ENABLED') {
    return;
  }
  const outcome = await sendEvents(endpoint, [{ timestamp: now.toISOString(), eventName: 'consent_granted' }]);
  if (outcome.ok) {
    logger.info('app.analytics', { outcome: 'sent', events: 1 });
  } else {
    logger.warn('app.analytics', { outcome: 'failed', events: 1, ...(outcome.status === undefined ? {} : { status: outcome.status }) });
  }
}

function fastFlushMs(): number | undefined {
  const value = Number(process.env['MONFIL_ANALYTICS_FLUSH_MS']);
  return process.env['E2E_TEST'] === '1' && Number.isFinite(value) && value > 0 ? value : undefined;
}

/** Loads the stored consent, starts counting failures from the log, and schedules the sending. */
export async function startUsageAnalytics(): Promise<void> {
  setCountingEnabled(await getUsageAnalyticsConsent() === 'granted');
  await recordAppLaunch();
  stopHealthCounters = startHealthCounters();
  const fast = fastFlushMs();
  const run = () => {
    void flushUsageAnalytics({ includeToday: fast !== undefined });
  };
  initialTimer = setTimeout(() => {
    run();
    intervalTimer = setInterval(run, fast ?? INTERVAL_MS);
    intervalTimer.unref();
  }, fast ?? INITIAL_DELAY_MS);
  initialTimer.unref();
}

export function stopUsageAnalytics(): void {
  clearTimeout(initialTimer);
  clearInterval(intervalTimer);
  initialTimer = undefined;
  intervalTimer = undefined;
  stopHealthCounters?.();
  stopHealthCounters = undefined;
}
