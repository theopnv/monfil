// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { resolveLanguage, resolveSystemLanguage } from './resolve-language';

describe('resolveSystemLanguage', () => {
  test.each([
    ['en-US', 'en'],
    ['en-GB', 'en'],
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
    ['zh', 'zh'],
    ['zh-CN', 'zh'],
    ['zh-SG', 'zh'],
    ['zh-Hans', 'zh'],
    ['zh-Hans-US', 'zh'],
    ['zh-Hans-TW', 'zh'],
    ['zh_CN', 'zh'],
    ['FR-fr', 'fr'],
  ])('maps %s to %s', (tag, expected) => {
    // Act
    const result = resolveSystemLanguage([tag]);

    // Assert
    expect(result).toBe(expected);
  });

  test.each(['zh-TW', 'zh-HK', 'zh-MO', 'zh-Hant', 'zh-Hant-TW'])('gives English for the traditional Chinese tag %s', (tag) => {
    // Act
    const result = resolveSystemLanguage([tag]);

    // Assert
    expect(result).toBe('en');
  });

  test.each([[[]], [['ko-KR']], [['not a tag']], [['']]])('gives English when no tag in %j is supported', (tags) => {
    // Act
    const result = resolveSystemLanguage(tags);

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

  test('ignores the system language when the user picked one', () => {
    // Act
    const result = resolveLanguage('ar', ['de-DE']);

    // Assert
    expect(result).toBe('ar');
  });
});
