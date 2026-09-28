// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

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
  test('loads lazy article images and removes an app card', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}</p>
      <figure><img src="data:image/svg+xml,%3Csvg/%3E" data-src="https://images.example.com/castlevania.png" alt="Castlevania on NES"><figcaption>Credit: Konami</figcaption></figure>
      <div id="installPwaDiv"><img src="https://images.example.com/app.png"><p>Add this app to your home screen</p></div>
      <div data-nosnippet><p>Read our weekly newsletter at <a href="https://4h90.mjlp.lu/signup">the sign-up page</a></p></div>
      <div class="product-block optid-no-ads"><p>More products to explore</p></div>
      <p>${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html).toContain('src="https://images.example.com/castlevania.png"');
    expect(result?.html).toContain('Credit: Konami');
    expect(result?.html).not.toContain('data:image/svg+xml');
    expect(result?.html).not.toContain('Add this app');
    expect(result?.html).not.toContain('weekly newsletter');
    expect(result?.html).not.toContain('More products to explore');
  });

  test('keeps a YouTube marker without the publisher consent text', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}</p>
      <figure><div class="embed-container"><iframe data-src="https://www.youtube.com/embed/5HcjtbfJfCY" title="Castlevania video"></iframe><div class="embed-consent-overlay"><p>Ce contenu est bloqué car vous n’avez pas accepté les cookies</p></div></div></figure>
      <p>${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html).toContain('data-monfil-embed="youtube"');
    expect(result?.html).toContain('https://www.youtube.com/watch?v=5HcjtbfJfCY');
    expect(result?.html).not.toContain('Ce contenu est bloqué');
    expect(result?.html).not.toContain('<iframe');
  });

  test('keeps an X post with an empty source blockquote', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}</p>
      <figure><blockquote data-conversation="none"><a href="https://twitter.com/JeremyNoronha/status/2103860923295281612"></a></blockquote></figure>
      <p>${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html).toContain('data-monfil-embed="x"');
    expect(result?.html).toContain('2103860923295281612');
  });

  test('keeps an X post after Readability removes its embed class', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}</p>
      <figure><blockquote><p>Launch coverage starts soon <a href="https://t.co/example">Watch live</a></p>— SpaceX (@SpaceX) <a href="https://x.com/SpaceX/status/2104354931595423762?ref_src=twsrc%5Etfw">September 27, 2026</a></blockquote></figure>
      <p>${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html).toContain('data-monfil-embed="x"');
    expect(result?.html).toContain('https://x.com/SpaceX/status/2104354931595423762');
    expect(result?.html).not.toContain('Launch coverage starts soon');
  });

  test('keeps a normal quote that links to an X post', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}</p>
      <blockquote><p>The mission starts today. <a href="https://x.com/SpaceX/status/2104354931595423762">Source post</a></p></blockquote>
      <p>${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html).toContain('The mission starts today.');
    expect(result?.html).not.toContain('data-monfil-embed');
  });

  test('removes follow controls and newsletter forms from story content', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}</p>
      <div><p>Follow topics and authors from this story</p><ul><li id="follow-author-article_footer-1">Verge Staff</li><li></li></ul></div>
      <form><h2>The Verge Daily</h2><label>Email (required)<input type="email"></label></form>
      <p>Further reading: <a href="/source">the source report</a>.</p><p>${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html).not.toContain('Follow topics and authors');
    expect(result?.html).not.toContain('The Verge Daily');
    expect(result?.html).toContain('Further reading');
  });

  test('removes modal image copies without removing story images', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}</p>
      <img src="images/demo_app.webp" alt="Report successfully generated">
      <div id="image-modal-1" class="modal"><img class="modal-content" src="images/demo_app.webp" alt="Report successfully generated"></div>
      <p>${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html?.match(/demo_app\.webp/g)).toHaveLength(1);
  });

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
