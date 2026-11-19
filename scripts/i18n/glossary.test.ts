// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';
import { TARGET_LANGUAGES } from './project.mts';

interface Glossary {
  keep: string[];
  terms: Record<string, { meaning: string; translations: Record<string, string> }>;
}

const glossary = JSON.parse(readFileSync(new URL('../../src/shared/i18n/glossary.json', import.meta.url), 'utf8')) as Glossary;

describe('the glossary', () => {
  test.each(Object.keys(glossary.terms).map((term) => ({ term })))('gives  a translation in every target language', ({ term }) => {
    // Assert
    expect(Object.keys(glossary.terms[term]?.translations ?? {}).sort()).toEqual([...TARGET_LANGUAGES].sort());
  });

  test('keeps the brand names that appear in the English text', () => {
    // Assert
    expect(glossary.keep).toEqual(expect.arrayContaining(['Monfil', 'RSS', 'OPML', 'YouTube']));
  });
});
