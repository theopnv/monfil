// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { parseErrorParams } from './error-params';

describe('parseErrorParams', () => {
  test('reads the JSON that setFeedFetchResult stores', () => {
    // Act
    const params = parseErrorParams('{"reason":"unresolvable","host":"a.example","count":2,"names":["x","y"]}');

    // Assert
    expect(params).toEqual({ reason: 'unresolvable', host: 'a.example', count: 2, names: ['x', 'y'] });
  });

  test.each([
    { name: 'null', stored: null },
    { name: 'undefined', stored: undefined },
    { name: 'an empty string', stored: '' },
    { name: 'text that is not JSON', stored: '{oops' },
    { name: 'a JSON array', stored: '["a"]' },
    { name: 'a JSON string', stored: '"a"' },
    { name: 'JSON null', stored: 'null' },
  ])('returns null for $name', ({ stored }) => {
    // Act
    const params = parseErrorParams(stored);

    // Assert
    expect(params).toBeNull();
  });
});
