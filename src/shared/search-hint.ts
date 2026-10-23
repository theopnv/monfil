// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

const EXAMPLES: Record<string, string> = {
  engineer: 'title:engineer -manager',
  analyst: 'title:"data analyst" -senior',
  designer: 'title:designer -lead',
  product: 'title:"product manager" -intern',
  sales: 'title:sales -intern',
  developer: 'title:developer -manager',
  marketing: 'title:marketing -intern',
};

export const DEFAULT_HINT_EXAMPLE = EXAMPLES['analyst'] ?? '';

/** The example query for the saved-search hint, chosen by the most common known role word in `titles`. */
export function pickHintExample(titles: string[]): string {
  const counts = new Map<string, number>();
  for (const title of titles) {
    for (const word of new Set(title.toLowerCase().split(/[^\p{L}]+/u))) {
      if (Object.hasOwn(EXAMPLES, word)) {
        counts.set(word, (counts.get(word) ?? 0) + 1);
      }
    }
  }
  const [best] = [...counts].sort((a, b) => b[1] - a[1]);
  return (best && EXAMPLES[best[0]]) || DEFAULT_HINT_EXAMPLE;
}
