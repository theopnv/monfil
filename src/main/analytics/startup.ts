// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { isStartingUp, markStartupComplete, resetStartupState } from '../app/startup-state';
import { observeLogs } from '../logging/logger';
import type { UsageCounter } from '../../shared/contracts';
import { incrementCounter } from './counters';

let failureCounted = false;
const moduleLoadedAt = Date.now();

export function startupTimeCounter(milliseconds: number): UsageCounter {
  if (milliseconds < 1000) {
    return 'startup_time_lt_1s';
  }
  if (milliseconds < 3000) {
    return 'startup_time_1_3s';
  }
  return milliseconds < 10_000 ? 'startup_time_3_10s' : 'startup_time_gt_10s';
}

function processAgeMs(now: Date): number {
  const createdAt = typeof process.getCreationTime === 'function' ? process.getCreationTime() : null;
  return now.getTime() - (createdAt ?? moduleLoadedAt);
}

/** Counts the first river render of this run, from the start of the process. Later calls count nothing. */
export function recordStartupComplete(now = new Date()): void {
  if (!isStartingUp()) {
    return;
  }
  markStartupComplete();
  if (failureCounted) {
    return;
  }
  void incrementCounter('startup_ok', now);
  void incrementCounter(startupTimeCounter(processAgeMs(now)), now);
}

export function recordStartupFailure(now = new Date()): void {
  if (!isStartingUp() || failureCounted) {
    return;
  }
  failureCounted = true;
  void incrementCounter('startup_failed', now);
}

/** Watches for an error before the first river render. The error reports carry the details. */
export function startStartupHealth(): () => void {
  return observeLogs((event, data, level) => {
    if (level !== 'error') {
      return;
    }
    const failed = event === 'system.failure' || event === 'ipc.failure' || event === 'renderer.failure'
      || (event === 'database.recovery' && (data as { outcome?: string }).outcome === 'failed');
    if (failed) {
      recordStartupFailure();
    }
  });
}

/** Lets a test start a new run. */
export function resetStartupForTest(): void {
  resetStartupState();
  failureCounted = false;
}
