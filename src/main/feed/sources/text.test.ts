// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { removeAll } from './text';

describe('removeAll', () => {
  test('removes every match', () => {
    // Act / Assert
    expect(removeAll('a<b>c<b>d', /<b>/g)).toBe('acd');
  });

  test('removes a match that the removal itself splices together', () => {
    // Act / Assert
    expect(removeAll('<<b>b>', /<b>/g)).toBe('');
  });

  test('replaces with the given text until nothing matches', () => {
    // Act / Assert
    expect(removeAll('xxxx', /xx/g, 'x')).toBe('x');
  });
});
