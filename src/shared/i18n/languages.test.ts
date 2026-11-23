// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { directionOf, isLanguageCode, isLanguageSetting } from './languages';

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

  test.each(['', null, undefined])('reject %j', (value) => {
    // Assert
    expect(isLanguageCode(value)).toBe(false);
    expect(isLanguageSetting(value)).toBe(false);
  });
});
