// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { stripHtml, truncateOnWordBoundary } from './strip-html';

describe('stripHtml', () => {

  test('decodes entities', () => {
    // Arrange
    const html = '<p>Tom &amp; Jerry&#8217;s</p>';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe("Tom & Jerry’s");
  });

  test('collapses whitespace and trims the ends', () => {
    // Arrange
    const html = '\n <p>Line one</p>\n\n<p>Line   two</p> \n';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe('Line one Line two');
  });

  test('strips a script tag exposed by removing a nested script tag', () => {
    // Arrange
    const html = '<scrip<script>ignored</script>t>alert(1)</script>Body';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe('Body');
  });

  test('drops the bracket of an unterminated tag and keeps the rest as text', () => {
    // Arrange
    const html = 'Body<script src=evil.js';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe('Bodyscript src=evil.js');
  });
});

describe('truncateOnWordBoundary', () => {
  test.each([
    { text: 'Short text', maxLength: 200 },
    { text: 'Short text', maxLength: 10 },
    { text: '  Short text  ', maxLength: 10 },
  ])('returns the trimmed text unchanged when it fits in $maxLength characters ($text)', ({ text, maxLength }) => {
    // Act
    const result = truncateOnWordBoundary(text, maxLength);

    // Assert
    expect(result).toBe('Short text');
  });

  test.each([
    { text: 'one two three four five', maxLength: 14, expected: 'one two three…' },
    { text: 'one two three four five', maxLength: 16, expected: 'one two three…' },
    { text: 'one  two', maxLength: 6, expected: 'one…' },
  ])('truncates $text to $maxLength on a word boundary and appends an ellipsis', ({ text, maxLength, expected }) => {
    // Act
    const result = truncateOnWordBoundary(text, maxLength);

    // Assert
    expect(result).toBe(expected);
  });

  test('falls back to a hard cut when there is no earlier space', () => {
    // Act
    const result = truncateOnWordBoundary('supercalifragilistic', 10);

    // Assert
    expect(result).toBe('supercalif…');
  });
});
