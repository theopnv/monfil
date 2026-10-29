// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { decodeTitle, removeAll } from './text';

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

describe('decodeTitle', () => {
  test('removes HTML tags that a feed puts around a title', () => {
    // Act / Assert
    expect(decodeTitle('<p>October’s <em>Epic</em> learning content</p>')).toBe('October’s Epic learning content');
  });

  test('removes tags that arrive entity-encoded', () => {
    // Act / Assert
    expect(decodeTitle('&lt;p&gt;Fish &amp; Chips&lt;/p&gt;')).toBe('Fish & Chips');
  });

  test('removes tags with attributes, self-closing tags and upper-case names', () => {
    // Act / Assert
    expect(decodeTitle('<A href="https://x.example/">Link</A><br/>here<img src="x.png">')).toBe('Link here');
  });

  test('keeps angle brackets that are not HTML elements', () => {
    // Act / Assert
    expect(decodeTitle('Vector<T> is faster when a < b > c')).toBe('Vector<T> is faster when a < b > c');
  });

  test('collapses the whitespace that tags and line breaks leave behind', () => {
    // Act / Assert
    expect(decodeTitle('  <p>\n  First\t catch </p>  ')).toBe('First catch');
  });
});
