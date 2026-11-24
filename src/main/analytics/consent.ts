// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { getAnalyticsEndpoint } from './config';
import { deleteAll, isCountingEnabled, setCountingEnabled } from './counters';
import { sendConsentGranted } from './scheduler';
import { getSentryEndpoint } from '../observability/config';
import { startObservability, stopObservability } from '../observability/sentry';
import {
  getUsageAnalyticsConsent,
  getUsageAnalyticsPromptHistory,
  recordUsageAnalyticsPromptShown,
  setUsageAnalyticsConsent,
  type UsageAnalyticsPromptHistory,
} from '../app/settings';
import { USAGE_ANALYTICS_NOTICE_VERSION, type UsageAnalyticsConsent, type UsageAnalyticsState } from '../../shared/contracts';

const PROMPT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export interface PromptInput extends UsageAnalyticsPromptHistory {
  consent: UsageAnalyticsConsent;
  now: Date;
}

/**
 * Decides whether the consent card shows: at the first run, then again every 30 days while the user has not
 * agreed. There is no limit on the number of times. One answer covers usage stats and error reports.
 */
export function shouldPromptForUsageAnalytics(input: PromptInput): boolean {
  if (input.consent === 'granted') {
    return false;
  }
  return input.lastShownAt === undefined || input.now.getTime() - input.lastShownAt.getTime() >= PROMPT_INTERVAL_MS;
}

/** Loads the stored choice into the counters, so nothing is counted before the user agreed. */
export async function loadUsageAnalyticsConsent(): Promise<void> {
  setCountingEnabled(await getUsageAnalyticsConsent() === 'granted');
}

export async function getUsageAnalyticsState(now = new Date()): Promise<UsageAnalyticsState> {
  const available = getAnalyticsEndpoint().name === 'ENABLED' || getSentryEndpoint().name === 'ENABLED';
  const consent = await getUsageAnalyticsConsent();
  // Hints are off in end-to-end runs, and the card would cover the same screens.
  const promptsAllowed = available && process.env['MONFIL_HINTS'] !== 'off';
  if (!promptsAllowed || consent === 'granted') {
    return { consent, shouldPrompt: false, available };
  }
  const history = await getUsageAnalyticsPromptHistory();
  return { consent, shouldPrompt: shouldPromptForUsageAnalytics({ consent, now, ...history }), available };
}

/** Stores the user's choice. Withdrawing stops the counting and the error reports at once and deletes every stored tally. */
export async function changeUsageAnalyticsConsent(choice: 'granted' | 'denied', now = new Date()): Promise<UsageAnalyticsState> {
  const wasGranted = isCountingEnabled();
  await setUsageAnalyticsConsent(choice, USAGE_ANALYTICS_NOTICE_VERSION, now);
  await recordUsageAnalyticsPromptShown(now);
  setCountingEnabled(choice === 'granted');
  if (choice === 'denied') {
    await deleteAll();
    await stopObservability();
  } else if (!wasGranted) {
    void sendConsentGranted();
    void startObservability();
  }
  return getUsageAnalyticsState(now);
}

export async function dismissUsageAnalyticsPrompt(now = new Date()): Promise<UsageAnalyticsState> {
  await recordUsageAnalyticsPromptShown(now);
  return getUsageAnalyticsState(now);
}
