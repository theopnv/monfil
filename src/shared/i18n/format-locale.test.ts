// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { resolveFormatLocale } from './format-locale';

describe('resolveFormatLocale', () => {
  test.each([
    { language: 'fr', system: 'fr-CA', expected: 'fr-CA' },
    { language: 'ar', system: 'ar-MA', expected: 'ar-MA' },
    { language: 'ar', system: 'ar-SA', expected: 'ar-SA' },
    { language: 'en', system: 'en-GB', expected: 'en-GB' },
    { language: 'pt', system: 'pt-PT', expected: 'pt-PT' },
    { language: 'zh', system: 'zh-Hans-CN', expected: 'zh-Hans-CN' },
    { language: 'de', system: 'de_AT', expected: 'de-AT' },
  ] as const)('keeps the system locale $system for a $language interface', ({ language, system, expected }) => {
    // Act
    const locale = resolveFormatLocale(language, system);

    // Assert
    expect(locale).toBe(expected);
  });

  test.each([
    { language: 'fr', system: 'en-US', expected: 'fr' },
    { language: 'ja', system: 'de-DE', expected: 'ja' },
    { language: 'pt', system: 'es-ES', expected: 'pt-BR' },
    { language: 'zh', system: 'zh-TW', expected: 'zh-Hans' },
    { language: 'zh', system: 'zh-Hant-HK', expected: 'zh-Hans' },
    { language: 'en', system: 'not a locale', expected: 'en' },
  ] as const)('uses the bare language when $system does not match a $language interface', ({ language, system, expected }) => {
    // Act
    const locale = resolveFormatLocale(language, system);

    // Assert
    expect(locale).toBe(expected);
  });
});
