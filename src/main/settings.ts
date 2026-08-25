import { db, dbReady } from './db/database';
import { querySettings } from './db/crud/query';

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
