// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { db, dbReady } from '../db/database';
import { logger } from '../logging/logger';
import { USAGE_COUNTERS, type UsageCounter } from '../../shared/contracts';

let consentGranted = false;

/**
 * Tells the counters whether the user agreed to share usage stats. While it is false, nothing is counted.
 * @param granted the current consent
 */
export function setCountingEnabled(granted: boolean): void {
  consentGranted = granted;
}

export function isCountingEnabled(): boolean {
  return consentGranted;
}

/**
 * The UTC calendar day of `date`, as `YYYY-MM-DD`.
 * @param date the moment to look up
 */
export function utcDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Adds one to today's tally for `name`. It never rejects: a lost count must not break the action that caused it.
 * @param name the counter to add to
 * @param now the moment of the action
 */
export async function incrementCounter(name: UsageCounter, now = new Date()): Promise<void> {
  if (!consentGranted) {
    return;
  }
  try {
    await dbReady;
    await db.insertInto('usage_counter')
      .values({ day: utcDay(now), name, value: 1 })
      .onConflict((oc) => oc.columns(['day', 'name']).doUpdateSet((eb) => ({ value: eb('usage_counter.value', '+', 1) })))
      .execute();
  } catch (error) {
    logger.warn('operation.failure', { operation: 'usage-counter' }, error);
  }
}

/**
 * Reads the tallies of one day. Counters with no tally are left out.
 * @param day the day as `YYYY-MM-DD`
 */
export async function readDay(day: string): Promise<Partial<Record<UsageCounter, number>>> {
  await dbReady;
  const rows = await db.selectFrom('usage_counter').select(['name', 'value']).where('day', '=', day).execute();
  const known: readonly string[] = USAGE_COUNTERS;
  return Object.fromEntries(rows.filter((row) => known.includes(row.name)).map((row) => [row.name, row.value]));
}

/** Lists the days that have a tally, oldest first. */
export async function listDays(): Promise<string[]> {
  await dbReady;
  const rows = await db.selectFrom('usage_counter').select('day').distinct().orderBy('day').execute();
  return rows.map((row) => row.day);
}

export async function deleteDays(days: readonly string[]): Promise<void> {
  // Stryker disable next-line ConditionalExpression,BlockStatement: SQLite accepts an empty IN list and deletes nothing, so the early return only saves a query
  if (days.length === 0) {
    return;
  }
  await dbReady;
  await db.deleteFrom('usage_counter').where('day', 'in', days).execute();
}

export async function deleteAll(): Promise<void> {
  await dbReady;
  await db.deleteFrom('usage_counter').execute();
}
