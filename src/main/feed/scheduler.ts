import { getRefreshInterval, type RefreshInterval } from '../settings';
import { broadcastToRenderers } from '../ipc/sendToRenderer';
import { refreshAllFeeds } from './refresh';

const MINUTE_IN_MS = 60 * 1000;

let timer: ReturnType<typeof setInterval> | undefined;
let running = false;

async function runCycle(): Promise<void> {
  // A feed that answers slowly must not let cycles stack up behind it.
  if (running) return;
  running = true;
  try {
    broadcastToRenderers('feeds:list', await refreshAllFeeds());
  } catch (error) {
    console.error('Feed refresh cycle failed.', error);
  } finally {
    running = false;
  }
}

function armTimer(interval: RefreshInterval): void {
  stopRefreshScheduler();
  if (interval === 'manual') return;
  timer = setInterval(() => void runCycle(), interval * MINUTE_IN_MS);
}

/**
 * Refreshes every feed once, then again on each period of the stored interval. Each cycle broadcasts
 * its result on `feeds:list`. The launch refresh runs even when the interval is `manual`.
 */
export async function startRefreshScheduler(): Promise<void> {
  // The period counts from launch, so the timer is armed before the launch refresh rather than after it.
  armTimer(await getRefreshInterval());
  await runCycle();
}

/**
 * Replaces the period of the repeating refresh, without refreshing right away.
 * @param interval the new interval, `manual` to stop repeating
 */
export function rescheduleRefresh(interval: RefreshInterval): void {
  armTimer(interval);
}

/** Disarms the timer. A cycle that is already in flight still finishes. */
export function stopRefreshScheduler(): void {
  if (timer === undefined) return;
  clearInterval(timer);
  timer = undefined;
}
