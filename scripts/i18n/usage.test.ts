// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { isUsed, scanUsage } from './usage.mts';

const usage = scanUsage([
  { name: 'a.tsx', text: "const x = t('feed.rowTitle', { context: focus }); const y = t('river:search.placeholder'); <input aria-label=\"search.label\" />" },
  { name: 'b.ts', text: 'const z = tErrors(`importSkipped.${reason}`); const w = t(`card.label_${state}`); const v = t(`${prefix}.x`); const k = t(`plain`);' },
]);

describe('scanUsage', () => {
  test('collects whole literals and the fixed start of templates with a value', () => {
    // Assert
    expect(usage.literals).toEqual(new Set(['feed.rowTitle', 'river:search.placeholder', 'search.label', 'plain']));
    expect([...usage.prefixes].sort()).toEqual(['card.label_', 'importSkipped.']);
  });
});

describe('isUsed', () => {
  test.each([
    { id: 'river:feed.rowTitle', used: true },
    { id: 'river:feed.rowTitle_hide', used: true },
    { id: 'river:feed.rowTitle_one', used: true },
    { id: 'river:search.placeholder', used: true },
    { id: 'reader:search.label', used: true },
    { id: 'errors:importSkipped.ALREADY', used: true },
    { id: 'river:card.label_read', used: true },
    { id: 'common:plain', used: true },
    { id: 'river:feed.never', used: false },
    { id: 'river:x', used: false },
  ])('says  is used: ', ({ id, used }) => {
    // Act / Assert
    expect(isUsed(id, usage)).toBe(used);
  });
});
