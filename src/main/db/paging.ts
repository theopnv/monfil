// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/**
 * Splits rows that were queried with `LIMIT limit + 1`. The extra row, when present, tells that a next page
 * exists without a count query, and the last row of the page is what the next cursor is made from.
 */
export function paginate<T>(rows: T[], limit: number): { page: T[]; last: T | undefined } {
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  return { page, last: hasMore ? page[page.length - 1] : undefined };
}
