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

  test('collapses whitespace', () => {
    // Arrange
    const html = '<p>Line one</p>\n\n<p>Line   two</p>';

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

  test('strips an unterminated tag with no closing bracket', () => {
    // Arrange
    const html = 'Body<script src=evil.js';

    // Act
    const result = stripHtml(html);

    // Assert
    expect(result).not.toContain('<script');
  });
});

describe('truncateOnWordBoundary', () => {
  test('returns text unchanged when under the limit', () => {
    // Act
    const result = truncateOnWordBoundary('Short text', 200);

    // Assert
    expect(result).toBe('Short text');
  });

  test('truncates on a word boundary and appends an ellipsis', () => {
    // Arrange
    const text = 'one two three four five';

    // Act
    const result = truncateOnWordBoundary(text, 14);

    // Assert
    expect(result).toBe('one two three…');
  });

  test('falls back to a hard cut when there is no earlier space', () => {
    // Act
    const result = truncateOnWordBoundary('supercalifragilistic', 10);

    // Assert
    expect(result).toBe('supercalif…');
  });
});
