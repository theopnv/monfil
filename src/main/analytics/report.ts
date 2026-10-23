// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { readLibraryState } from './library';
import { readDay, utcDay } from './counters';
import { getPreferencesSnapshot } from './preferences';
import { buildDailySummary } from './summary';
import type { DailySummaryProps } from '../../shared/contracts';

/**
 * Builds the summary of one day from the tallies, the library, and the last reported preferences.
 * @param day the day as `YYYY-MM-DD`
 */
export async function summarizeDay(day: string): Promise<DailySummaryProps> {
  const [counters, library] = await Promise.all([readDay(day), readLibraryState()]);
  return buildDailySummary({ day, counters, library, preferences: getPreferencesSnapshot() });
}

/**
 * Builds the summary that would be sent for today, for the "See what is sent" view.
 * @param now the current time
 */
export function previewSummary(now = new Date()): Promise<DailySummaryProps> {
  return summarizeDay(utcDay(now));
}
