import { describe, expect, test } from 'vitest';
import { deriveArticleContentStatus, extractArticle } from './extractArticle';
import { MIN_ARTICLE_LENGTH } from '../constants';

const PARAGRAPH = 'This is a long paragraph about something interesting that readers care about deeply. '.repeat(6);

function articlePage(body: string): string {
  return `<!doctype html>
<html>
<head><title>A Great Article</title></head>
<body>
<nav><a href="/">Home</a><a href="/about">About</a></nav>
<article>
<h1>A Great Article</h1>
${body}
</article>
<footer>Copyright 2024</footer>
</body>
</html>`;
}

const LONG_ARTICLE_HTML = articlePage(`
<p>${PARAGRAPH}</p>
<p>Another paragraph continues the story with more detail and context for the reader to enjoy. It has a <a href="/related-post">related post</a> linked inline.</p>
<script>window.__pwned = true;</script>
<img src="photo.jpg" onclick="window.__pwned = true;">
<iframe src="https://evil.example"></iframe>
<style>p{color:red}</style>
<form><input></form>
<a href="javascript:window.__pwned = true;">bad link</a>
`);

describe('extractArticle', () => {
  test('extracts the body text and its word count', () => {
    // Act
    const result = extractArticle(LONG_ARTICLE_HTML, 'https://example.com/article');

    // Assert
    expect(result).toBeDefined();
    expect(result?.text).toContain('long paragraph about something interesting');
    expect(result?.wordCount).toBeGreaterThan(20);
    expect(result?.wordCount).toBe(result?.text.trim().split(/\s+/).filter(Boolean).length);
  });

  test('resolves a relative href against the page url', () => {
    // Act
    const result = extractArticle(LONG_ARTICLE_HTML, 'https://example.com/section/article');

    // Assert
    expect(result?.html).toContain('href="https://example.com/related-post"');
  });

  test('strips <script> tags and onclick attributes from the output', () => {
    // Act
    const result = extractArticle(LONG_ARTICLE_HTML, 'https://example.com/article');

    // Assert
    expect(result?.html).not.toContain('<script');
    expect(result?.html).not.toContain('onclick');
  });

  test('strips iframe, style and form tags from the output', () => {
    // Act
    const result = extractArticle(LONG_ARTICLE_HTML, 'https://example.com/article');

    // Assert
    expect(result?.html).not.toContain('<iframe');
    expect(result?.html).not.toContain('<style');
    expect(result?.html).not.toContain('<form');
    expect(result?.html).not.toContain('<input');
  });

  test('neutralizes a javascript: href in the output', () => {
    // Act
    const result = extractArticle(LONG_ARTICLE_HTML, 'https://example.com/article');

    // Assert
    expect(result?.html).not.toContain('javascript:');
  });

  test('returns undefined when there is no article content to find', () => {
    // Act
    const result = extractArticle('<html><head></head><body></body></html>', 'https://example.com/empty');

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('deriveArticleContentStatus', () => {
  test('is "ok" for an article at or above the minimum length', () => {
    // Arrange
    const article = { html: '<p>x</p>', text: 'x'.repeat(MIN_ARTICLE_LENGTH), wordCount: 1 };

    // Act & Assert
    expect(deriveArticleContentStatus(article)).toBe('ok');
  });

  test('is "too_short" for an article below the minimum length', () => {
    // Arrange
    const article = { html: '<p>x</p>', text: 'x'.repeat(MIN_ARTICLE_LENGTH - 1), wordCount: 1 };

    // Act & Assert
    expect(deriveArticleContentStatus(article)).toBe('too_short');
  });

  test('is "failed" when there is no article', () => {
    // Act & Assert
    expect(deriveArticleContentStatus(undefined)).toBe('failed');
  });
});
