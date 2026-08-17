import { db, dbReady } from './database';
import { querySettings } from './db/query';

export type RefreshInterval = 15 | 30 | 60 | 360 | 'manual';

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
  await dbReady;
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
