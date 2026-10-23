// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { stripHtml, truncateOnWordBoundary } from './strip-html';

describe('stripHtml', () => {
  test('removes style blocks and their content', () => {
    // Arrange
    const html = '<style>.a { color: red; }</style><p>Body</p>';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe('Body');
  });

  test('removes script blocks and their content', () => {
    // Arrange
    const html = '<p>Body</p><script>alert("hi")</script>';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe('Body');
  });

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

  test('returns an empty string for empty input', () => {
    // Act
    const result = stripHtml('');

    // Assert
    expect(result).toBe('');
  });

  test('passes plain text through unchanged', () => {
    // Act
    const result = stripHtml('Just plain text');

    // Assert
    expect(result).toBe('Just plain text');
  });

  test('strips a script tag that is only revealed after entity decoding', () => {
    // Arrange
    const html = '&lt;script&gt;alert(1)&lt;/script&gt;Body';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe('Body');
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

  test('strips a tag nested inside another tag', () => {
    // Arrange
    const html = '<scr<a>ipt>alert(1)</script>Body';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).toBe('ipt>alert(1)Body');
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
