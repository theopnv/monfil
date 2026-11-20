// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** Whether `pubDate` names a time. A feed can hold a date that does not parse, or none. */
export function hasPublishedDate(pubDate: string): boolean {
  return Number.isFinite(new Date(pubDate).getTime());
}

/** The time `pubDate` names, or `fallback` when it names none. SQLite cannot parse RFC-822 dates, so this runs in JS rather than in SQL. */
export function publishedAtOrFallback(pubDate: string, fallback: number): number {
  const timestamp = new Date(pubDate).getTime();
  return Number.isFinite(timestamp) ? timestamp : fallback;
}
