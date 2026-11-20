// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { DailySummaryProps, UsageCounter, UsagePreferences } from '../../shared/contracts';
import { USAGE_COUNTERS } from '../../shared/contracts';
import type { LanguageCode } from '../../shared/i18n/languages';
import type { LibraryState } from './library';

const MAX_STRING_LENGTH = 180;

/** Groups a feed count so the exact size of a library is never sent. */
export function feedsBucket(feeds: number): string {
  if (feeds <= 0) {
    return '0';
  }
  if (feeds <= 5) {
    return '1-5';
  }
  if (feeds <= 20) {
    return '6-20';
  }
  return feeds <= 100 ? '21-100' : '100+';
}

export interface SummaryInput {
  day: string;
  counters: Partial<Record<UsageCounter, number>>;
  library: LibraryState;
  preferences: UsagePreferences | undefined;
  /** The interface language in use, not the operating system locale that the event already carries. */
  language: LanguageCode;
}

function cut(value: string): string {
  return value.slice(0, MAX_STRING_LENGTH);
}

/** Builds the props of one `daily_summary` event. It holds counts, buckets, and settings, and no feed, article, or person. */
export function buildDailySummary({ day, counters, library, preferences, language }: SummaryInput): DailySummaryProps {
  const props: DailySummaryProps = { day };
  for (const name of USAGE_COUNTERS) {
    props[name] = counters[name] ?? 0;
  }
  props['feeds_bucket'] = feedsBucket(library.feeds);
  props['workspaces_count'] = library.workspaces;
  props['categories_count'] = library.categories;
  props['feed_kinds'] = cut(library.feedKinds.join('+') || 'none');
  props['pref_density'] = preferences?.density ?? 'unknown';
  props['pref_theme'] = preferences?.theme ?? 'unknown';
  props['pref_language'] = language;
  props['pref_hide_read_items'] = preferences ? String(preferences.hideReadItems) : 'unknown';
  props['pref_mark_read_on_scroll'] = preferences ? String(preferences.markReadOnScroll) : 'unknown';
  props['pref_open_links_externally'] = preferences ? String(preferences.openLinksExternally) : 'unknown';
  props['pref_keyboard_navigation'] = preferences ? String(preferences.keyboardNavigation) : 'unknown';
  return props;
}
