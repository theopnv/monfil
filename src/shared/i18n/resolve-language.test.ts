// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { resolveLanguage, resolveSystemLanguage } from './resolve-language';

describe('resolveSystemLanguage', () => {
  test.each([
    ['fr', 'fr'],
    ['fr-CA', 'fr'],
    ['de-AT', 'de'],
    ['it-CH', 'it'],
    ['ja-JP', 'ja'],
    ['ar-SA', 'ar'],
    ['ar-MA', 'ar'],
    ['es-MX', 'es'],
    ['es-419', 'es'],
    ['es-ES', 'es'],
    ['pt-BR', 'pt'],
    ['pt-PT', 'pt'],
    ['zh_CN', 'zh'],
    ['FR-fr', 'fr'],
  ])('maps %s to %s', (tag, expected) => {
    // Act
    const result = resolveSystemLanguage([tag]);

    // Assert
    expect(result).toBe(expected);
  });

  test.each([ 'zh-Hant-TW'])('gives English for the traditional Chinese tag %s', (tag) => {
    // Act
    const result = resolveSystemLanguage([tag]);

    // Assert
    expect(result).toBe('en');
  });

  test('uses the first supported tag in the order the user set', () => {
    // Act
    const result = resolveSystemLanguage(['ko-KR', 'zh-TW', 'ja-JP', 'fr-FR']);

    // Assert
    expect(result).toBe('ja');
  });
});

describe('resolveLanguage', () => {
  test('follows the system language when the setting is system', () => {
    // Act
    const result = resolveLanguage('system', ['de-DE']);

    // Assert
    expect(result).toBe('de');
  });
});
