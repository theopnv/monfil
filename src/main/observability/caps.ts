// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { getErrorReportCaps, setErrorReportCaps } from '../app/settings';

export interface CapLimits {
  /** The same fingerprint is sent once while the app runs. */
  perFingerprintPerSession: number;
  perFingerprintPerDay: number;
  /** Protects the monthly quota of the error tracker when one install loops. */
  totalPerDay: number;
}

export const DEFAULT_CAP_LIMITS: CapLimits = { perFingerprintPerSession: 1, perFingerprintPerDay: 5, totalPerDay: 30 };

export interface CapStore {
  load: () => Promise<string | undefined>;
  save: (text: string) => Promise<void>;
}

export const settingsCapStore: CapStore = { load: getErrorReportCaps, save: setErrorReportCaps };

interface DayTally {
  day: string;
  total: number;
  fingerprints: Record<string, number>;
}

function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function parseTally(text: string | undefined, day: string): DayTally {
  const fresh: DayTally = { day, total: 0, fingerprints: {} };
  if (!text) {
    return fresh;
  }
  try {
    const value = JSON.parse(text) as Partial<DayTally>;
    const valid = value.day === day && Number.isSafeInteger(value.total) && typeof value.fingerprints === 'object' && value.fingerprints !== null;
    return valid ? { day, total: value.total as number, fingerprints: value.fingerprints as Record<string, number> } : fresh;
  } catch {
    return fresh;
  }
}

export interface Caps {
  /** Says whether an event with this fingerprint may be sent, and counts it when it may. */
  accept: (fingerprint: string) => Promise<boolean>;
}

export function createCaps(store: CapStore = settingsCapStore, limits: CapLimits = DEFAULT_CAP_LIMITS, now: () => Date = () => new Date()): Caps {
  const sessionCounts = new Map<string, number>();
  let queue: Promise<unknown> = Promise.resolve();

  async function decide(fingerprint: string): Promise<boolean> {
    if ((sessionCounts.get(fingerprint) ?? 0) >= limits.perFingerprintPerSession) {
      return false;
    }
    const day = utcDay(now());
    const tally = parseTally(await store.load().catch(() => undefined), day);
    if (tally.total >= limits.totalPerDay || (tally.fingerprints[fingerprint] ?? 0) >= limits.perFingerprintPerDay) {
      return false;
    }
    tally.total += 1;
    tally.fingerprints[fingerprint] = (tally.fingerprints[fingerprint] ?? 0) + 1;
    sessionCounts.set(fingerprint, (sessionCounts.get(fingerprint) ?? 0) + 1);
    await store.save(JSON.stringify(tally)).catch(() => undefined);
    return true;
  }

  return {
    accept(fingerprint) {
      const result = queue.then(() => decide(fingerprint));
      queue = result.catch(() => undefined);
      return result;
    },
  };
}
