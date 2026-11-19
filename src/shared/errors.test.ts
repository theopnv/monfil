// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import errors from './i18n/locales/en/errors.json';
import { UNSUPPORTED_REASONS } from './errors';

const codeKeys = Object.keys(errors.codes);

describe('UNSUPPORTED_REASONS', () => {
  test.each(UNSUPPORTED_REASONS.map((reason) => ({ reason })))('$reason has a sentence', ({ reason }) => {
    // Assert
    expect(codeKeys.filter((key) => key.startsWith(`UNSUPPORTED_FORMAT_${reason}`))).not.toHaveLength(0);
  });

  test('every UNSUPPORTED_FORMAT sentence belongs to a reason', () => {
    // Act
    const strays = codeKeys
      .filter((key) => key.startsWith('UNSUPPORTED_FORMAT_'))
      .filter((key) => !UNSUPPORTED_REASONS.some((reason) => key === `UNSUPPORTED_FORMAT_${reason}` || key.startsWith(`UNSUPPORTED_FORMAT_${reason}_`)));

    // Assert
    expect(strays).toEqual([]);
  });
});
