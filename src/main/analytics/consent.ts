// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { getAnalyticsEndpoint } from './config';
import { deleteAll, isCountingEnabled, setCountingEnabled } from './counters';
import { countFeeds } from './library';
import { sendConsentGranted } from './scheduler';
import {
  getUsageAnalyticsConsent,
  getUsageAnalyticsPromptHistory,
  recordUsageAnalyticsPromptDismissed,
  setUsageAnalyticsConsent,
  type UsageAnalyticsPromptHistory,
} from '../app/settings';
import { USAGE_ANALYTICS_NOTICE_VERSION, type UsageAnalyticsConsent, type UsageAnalyticsState } from '../../shared/contracts';

const MIN_LAUNCHES = 2;
const MAX_PROMPTS = 2;
const PROMPT_INTERVAL_MS = 14 * 24 * 60 * 60 * 1000;

export interface PromptInput extends UsageAnalyticsPromptHistory {
  consent: UsageAnalyticsConsent;
  feedCount: number;
  now: Date;
}

/**
 * Decides whether the consent card shows: after the user has a feed and has opened the app twice,
 * at most twice, and no more than once every 14 days.
 * @param input the consent, the library size, and the history of the card
 */
export function shouldPromptForUsageAnalytics(input: PromptInput): boolean {
  if (input.consent !== 'unset' || input.feedCount < 1 || input.launchCount < MIN_LAUNCHES || input.promptCount >= MAX_PROMPTS) {
    return false;
  }
  return input.lastShownAt === undefined || input.now.getTime() - input.lastShownAt.getTime() >= PROMPT_INTERVAL_MS;
}

/** Loads the stored choice into the counters, so nothing is counted before the user agreed. */
export async function loadUsageAnalyticsConsent(): Promise<void> {
  setCountingEnabled(await getUsageAnalyticsConsent() === 'granted');
}

/**
 * Reads the consent and whether the card shows now.
 * @param now the current time
 */
export async function getUsageAnalyticsState(now = new Date()): Promise<UsageAnalyticsState> {
  const available = getAnalyticsEndpoint().name === 'ENABLED';
  const consent = await getUsageAnalyticsConsent();
  // Hints are off in end-to-end runs, and the card would cover the same screens.
  const promptsAllowed = available && process.env['MONFIL_HINTS'] !== 'off';
  if (!promptsAllowed || consent !== 'unset') {
    return { consent, shouldPrompt: false, available };
  }
  const [history, feedCount] = await Promise.all([getUsageAnalyticsPromptHistory(), countFeeds()]);
  return { consent, shouldPrompt: shouldPromptForUsageAnalytics({ consent, feedCount, now, ...history }), available };
}

/**
 * Stores the user's choice. Withdrawing stops the counting at once and deletes every stored tally.
 * @param choice what the user picked
 * @param now the time of the choice
 */
export async function changeUsageAnalyticsConsent(choice: 'granted' | 'denied', now = new Date()): Promise<UsageAnalyticsState> {
  const wasGranted = isCountingEnabled();
  await setUsageAnalyticsConsent(choice, USAGE_ANALYTICS_NOTICE_VERSION, now);
  setCountingEnabled(choice === 'granted');
  if (choice === 'denied') {
    await deleteAll();
  } else if (!wasGranted) {
    void sendConsentGranted();
  }
  return getUsageAnalyticsState(now);
}

/**
 * Records that the user put the card off for later.
 * @param now the time the card was closed
 */
export async function dismissUsageAnalyticsPrompt(now = new Date()): Promise<UsageAnalyticsState> {
  await recordUsageAnalyticsPromptDismissed(now);
  return getUsageAnalyticsState(now);
}
