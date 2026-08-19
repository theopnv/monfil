import { describe, expect, test } from 'vitest';
import { sanitizeArticleHtml } from './sanitize-html';

describe('sanitizeArticleHtml', () => {
  test('keeps allow-listed markup', () => {
    // Arrange
    const html = '<p>Hello <strong>world</strong>, see <a href="https://example.com">this</a>.</p>';

    // Act
    const result = sanitizeArticleHtml(html);

    // Assert
    expect(result).toBe(html);
  });

  test('strips script tags and their content', () => {
    // Act
    const result = sanitizeArticleHtml('<p>Safe</p><script>alert(1)</script>');

    // Assert
    expect(result).toBe('<p>Safe</p>');
  });

  test('strips event handler attributes', () => {
    // Act
    const result = sanitizeArticleHtml('<img src="x.png" onerror="alert(1)">');

    // Assert
    expect(result).not.toContain('onerror');
  });

  test('strips style attributes', () => {
    // Act
    const result = sanitizeArticleHtml('<p style="color:red">Text</p>');

    // Assert
    expect(result).not.toContain('style');
  });

  test('strips iframe, style, and form tags', () => {
    // Act
    const result = sanitizeArticleHtml('<iframe src="https://evil.example"></iframe><style>p{color:red}</style><form><input></form>');

    // Assert
    expect(result).toBe('');
  });

  test('neutralizes javascript: hrefs', () => {
    // Act
    const result = sanitizeArticleHtml('<a href="javascript:alert(1)">Click</a>');

    // Assert
    expect(result).not.toContain('javascript:');
  });

  test('keeps table markup', () => {
    // Arrange
    const html = '<table><thead><tr><th>Name</th></tr></thead><tbody><tr><td>Value</td></tr></tbody></table>';

    // Act
    const result = sanitizeArticleHtml(html);

    // Assert
    expect(result).toBe(html);
  });

  test('keeps an hr tag', () => {
    // Act
    const result = sanitizeArticleHtml('<p>Before</p><hr><p>After</p>');

    // Assert
    expect(result).toBe('<p>Before</p><hr><p>After</p>');
  });

  test('returns empty output for empty input', () => {
    // Act
    const result = sanitizeArticleHtml('');

    // Assert
    expect(result).toBe('');
  });
});
