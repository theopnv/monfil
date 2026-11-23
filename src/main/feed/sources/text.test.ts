// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { decodeTitle } from './text';

describe('decodeTitle', () => {

  test('removes tags that arrive entity-encoded', () => {
    // Act / Assert
    expect(decodeTitle('&lt;p&gt;Fish &amp; Chips&lt;/p&gt;')).toBe('Fish & Chips');
  });

  test('removes tags with attributes, self-closing tags and upper-case names', () => {
    // Act / Assert
    expect(decodeTitle('<A href="https://x.example/">Link</A><br/>here<img src="x.png">')).toBe('Link here');
  });

  test('collapses the whitespace that tags and line breaks leave behind', () => {
    // Act / Assert
    expect(decodeTitle('  <p>\n  First\t catch </p>  ')).toBe('First catch');
  });
});
