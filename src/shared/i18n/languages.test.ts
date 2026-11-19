// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { LANGUAGES, directionOf, isLanguageCode, isLanguageSetting } from './languages';

describe('LANGUAGES', () => {
  test('lists the nine interface languages with Arabic as the only right-to-left one', () => {
    // Assert
    expect(LANGUAGES.map((language) => language.code)).toEqual(['en', 'fr', 'de', 'es', 'it', 'pt', 'zh', 'ja', 'ar']);
    expect(LANGUAGES.filter((language) => language.dir === 'rtl').map((language) => language.code)).toEqual(['ar']);
  });
});

describe('directionOf', () => {
  test.each([['en', 'ltr'], ['ja', 'ltr'], ['ar', 'rtl']] as const)('gives the direction of %s as %s', (code, expected) => {
    // Assert
    expect(directionOf(code)).toBe(expected);
  });
});

describe('isLanguageCode and isLanguageSetting', () => {
  test.each(['en', 'ja', 'ar'])('accept the code %s', (code) => {
    // Assert
    expect(isLanguageCode(code)).toBe(true);
    expect(isLanguageSetting(code)).toBe(true);
  });

  test('isLanguageSetting also accepts system, and isLanguageCode does not', () => {
    // Assert
    expect(isLanguageSetting('system')).toBe(true);
    expect(isLanguageCode('system')).toBe(false);
  });

  test.each(['', 'EN', 'en-US', 'zh-Hans', 'ko', 5, null, undefined])('reject %j', (value) => {
    // Assert
    expect(isLanguageCode(value)).toBe(false);
    expect(isLanguageSetting(value)).toBe(false);
  });
});
