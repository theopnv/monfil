// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { JSDOM } from 'jsdom';
import { describe, expect, test } from 'vitest';
import { deriveArticleContentStatus, extractArticle } from './extractArticle';
import { MIN_ARTICLE_LENGTH } from '../lib/constants';

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
  test('keeps footnote links and target IDs in the extracted article', () => {
    // Arrange
    const html = articlePage(`<p>${PARAGRAPH}<a href="#footnote-1">Footnote</a></p><p id="footnote-1">${PARAGRAPH}</p>`);

    // Act
    const result = extractArticle(html, 'https://example.com/story');

    // Assert
    expect(result?.html).toContain('href="#footnote-1"');
    expect(result?.html).toContain('id="footnote-1"');
  });

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

const PAGE = 'https://example.com/blog/story';

function extractBody(body: string, url = PAGE): Document {
  const result = extractArticle(articlePage(`<p>${PARAGRAPH}</p>\n${body}\n<p>${PARAGRAPH}</p>`), url);
  return new JSDOM(result?.html ?? '').window.document;
}

describe('extractArticle lazy images', () => {
  test.each([
    ['data-src', 'data-src="https://cdn.example.com/a.png"', 'https://cdn.example.com/a.png'],
    ['data-lazy-src', 'data-lazy-src="https://cdn.example.com/b.png"', 'https://cdn.example.com/b.png'],
    ['data-original', 'data-original="https://cdn.example.com/c.png"', 'https://cdn.example.com/c.png'],
    ['a relative data-src', 'data-src="img/d.png"', 'https://example.com/blog/img/d.png'],
    ['a root-relative data-src', 'data-src="/img/e.png"', 'https://example.com/img/e.png'],
    ['data-src before data-lazy-src', 'data-lazy-src="https://cdn.example.com/x.png" data-src="https://cdn.example.com/f.png"', 'https://cdn.example.com/f.png'],
    ['data-lazy-src before data-original', 'data-original="https://cdn.example.com/x.png" data-lazy-src="https://cdn.example.com/g.png"', 'https://cdn.example.com/g.png'],
    ['the first data-srcset candidate', 'data-srcset="https://cdn.example.com/h-1x.png 1x, https://cdn.example.com/h-2x.png 2x"', 'https://cdn.example.com/h-1x.png'],
    ['a relative data-srcset candidate after whitespace', 'data-srcset="  /i.png 1x"', 'https://example.com/i.png'],
    ['data-srcset when data-src is not http', 'data-src="ftp://cdn.example.com/j.png" data-srcset="https://cdn.example.com/j.png 1x"', 'https://cdn.example.com/j.png'],
    ['data-src over data-srcset', 'data-src="https://cdn.example.com/k.png" data-srcset="https://cdn.example.com/other.png 1x"', 'https://cdn.example.com/k.png'],
  ])('sets src from %s on an image with a data: placeholder', (_name, attributes, expected) => {
    // Act
    const image = extractBody(`<img src="data:image/gif;base64,R0lGOD" alt="lazy" ${attributes}>`).querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe(expected);
  });

  test.each([
    ['no src', ''],
    ['an empty src', 'src=""'],
    ['an about:blank src', 'src="about:blank"'],
  ])('sets src from data-src on an image with %s', (_name, src) => {
    // Act
    const image = extractBody(`<img ${src} data-src="https://cdn.example.com/l.png" alt="lazy">`).querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('https://cdn.example.com/l.png');
  });

  test('keeps a real src over the lazy source', () => {
    // Act
    const image = extractBody('<img src="https://cdn.example.com/real.png" data-src="https://cdn.example.com/lazy.png" alt="real">').querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('https://cdn.example.com/real.png');
  });

  test.each([
    'javascript:alert(1)',
    'data:text/html,hi',
  ])('does not use the non-http lazy source %s', (lazy) => {
    // Act
    const image = extractBody(`<img src="data:image/gif;base64,R0lGOD" data-src="${lazy}" alt="lazy">`).querySelector('img');

    // Assert
    expect(image?.getAttribute('src') ?? '').not.toMatch(/^(javascript|data:text):/);
  });

  test('accepts a plain http lazy source', () => {
    // Act
    const image = extractBody('<img src="data:image/gif;base64,R0lGOD" data-src="http://cdn.example.com/r.png" alt="lazy">').querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('http://cdn.example.com/r.png');
  });

  test('copies data-srcset to srcset', () => {
    // Act
    const image = extractBody('<img src="https://cdn.example.com/n.png" data-srcset="https://cdn.example.com/n-2x.png 2x" alt="x">').querySelector('img');

    // Assert
    expect(image?.getAttribute('srcset')).toBe('https://cdn.example.com/n-2x.png 2x');
  });

  test('keeps an existing srcset over data-srcset', () => {
    // Act
    const image = extractBody('<img src="https://cdn.example.com/o.png" srcset="https://cdn.example.com/o-2x.png 2x" data-srcset="https://cdn.example.com/other.png 2x" alt="x">').querySelector('img');

    // Assert
    expect(image?.getAttribute('srcset')).toBe('https://cdn.example.com/o-2x.png 2x');
  });

  test('copies the data-srcset of a picture source to srcset', () => {
    // Act
    const source = extractBody('<picture><source data-srcset="https://cdn.example.com/p.webp" type="image/webp"><img src="https://cdn.example.com/p.jpg" alt="x"></picture>').querySelector('picture source');

    // Assert
    expect(source?.getAttribute('srcset')).toBe('https://cdn.example.com/p.webp');
  });

  test('keeps the srcset of a picture source', () => {
    // Act
    const source = extractBody('<picture><source srcset="https://cdn.example.com/q.webp" data-srcset="https://cdn.example.com/other.webp" type="image/webp"><img src="https://cdn.example.com/q.jpg" alt="x"></picture>').querySelector('picture source');

    // Assert
    expect(source?.getAttribute('srcset')).toBe('https://cdn.example.com/q.webp');
  });
});

describe('extractArticle iframe embeds', () => {
  test.each([
    ['src', 'src="https://www.youtube.com/embed/5HcjtbfJfCY"'],
    ['data-src', 'data-src="https://www.youtube.com/embed/5HcjtbfJfCY" src="about:blank"'],
  ])('replaces a YouTube iframe with a marker read from %s', (_name, attributes) => {
    // Act
    const marker = extractBody(`<iframe ${attributes} title="  Trailer  "></iframe>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('data-monfil-embed')).toBe('youtube');
    expect(marker?.getAttribute('href')).toBe('https://www.youtube.com/watch?v=5HcjtbfJfCY');
    expect(marker?.textContent).toBe('Trailer');
  });

  test.each([
    ['no title', ''],
    ['a blank title', 'title="   "'],
  ])('labels the marker of an iframe with %s by its provider', (_name, title) => {
    // Act
    const marker = extractBody(`<iframe src="https://player.vimeo.com/video/76979871" ${title}></iframe>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('data-monfil-embed')).toBe('vimeo');
    expect(marker?.textContent).toBe('vimeo embed');
  });

  test('replaces an iframe of another video host with a link', () => {
    // Act
    const document = extractBody('<iframe src="https://www.dailymotion.com/embed/video/x7tgad0" title=" Clip "></iframe>');
    const link = [...document.querySelectorAll('a')].find((anchor) => anchor.textContent === 'Clip');

    // Assert
    expect(link?.getAttribute('href')).toBe('https://www.dailymotion.com/embed/video/x7tgad0');
    expect(link?.hasAttribute('data-monfil-embed')).toBe(false);
    expect(document.querySelector('iframe')).toBeNull();
  });

  test.each([
    ['no title', ''],
    ['a blank title', 'title="  "'],
  ])('labels the link of an iframe with %s', (_name, title) => {
    // Act
    const document = extractBody(`<iframe src="https://www.dailymotion.com/embed/video/x7tgad0" ${title}></iframe>`);
    const link = [...document.querySelectorAll('a')].find((anchor) => anchor.textContent === 'Open embedded content');

    // Assert
    expect(link?.getAttribute('href')).toBe('https://www.dailymotion.com/embed/video/x7tgad0');
  });

  test('removes an iframe whose source is not http', () => {
    // Act
    const document = extractBody('<iframe src="javascript:void(0)" data-ref="//youtube.com/x" title="Sneaky"></iframe>');

    // Assert
    expect(document.querySelector('iframe')).toBeNull();
    expect(document.body.innerHTML).not.toContain('javascript:');
    expect(document.body.textContent).not.toContain('Sneaky');
    expect(document.body.textContent).not.toContain('Open embedded content');
  });
});

describe('extractArticle blockquote embeds', () => {
  const TWEET_URL = 'https://x.com/SpaceX/status/2104354931595423762';
  const INSTAGRAM_URL = 'https://www.instagram.com/p/Cx123456789/';

  test('replaces an empty blockquote with its Instagram permalink by a marker', () => {
    // Act
    const marker = extractBody(`<blockquote data-instgrm-permalink="${INSTAGRAM_URL}"></blockquote>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('data-monfil-embed')).toBe('instagram');
    expect(marker?.getAttribute('href')).toBe(INSTAGRAM_URL);
    expect(marker?.textContent).toBe('instagram embed');
  });

  test('replaces a blockquote with only whitespace and an embed link by a marker', () => {
    // Act
    const marker = extractBody(`<blockquote>  \n <a href="${INSTAGRAM_URL}"></a> </blockquote>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('data-monfil-embed')).toBe('instagram');
  });

  test('uses the first link that is an embed', () => {
    // Act
    const marker = extractBody(`<figure><blockquote><a href="https://t.co/abc"></a><a href="/relative"></a><a href="${TWEET_URL}"></a></blockquote></figure>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('href')).toBe(TWEET_URL);
  });

  test('keeps a quote with text that links to an Instagram post', () => {
    // Act
    const document = extractBody(`<blockquote><p>Look at this photo. <a href="${INSTAGRAM_URL}">Source</a></p></blockquote>`);

    // Assert
    expect(document.querySelector('a[data-monfil-embed]')).toBeNull();
    expect(document.querySelector('blockquote')?.textContent).toContain('Look at this photo.');
  });

  test('keeps a quote with text inside a figure that links to a video', () => {
    // Act
    const document = extractBody('<figure><blockquote><p>Watch this talk. <a href="https://www.youtube.com/watch?v=5HcjtbfJfCY">Video</a></p></blockquote></figure>');

    // Assert
    expect(document.querySelector('a[data-monfil-embed]')).toBeNull();
    expect(document.querySelector('blockquote')?.textContent).toContain('Watch this talk.');
  });

  test('keeps a quote without any embed link', () => {
    // Act
    const document = extractBody('<blockquote><p>Plain words from someone. <a href="https://example.org/page">Page</a></p></blockquote>');

    // Assert
    expect(document.querySelector('a[data-monfil-embed]')).toBeNull();
    expect(document.querySelector('blockquote')?.textContent).toContain('Plain words from someone.');
  });

  test('keeps an empty blockquote without an embed link', () => {
    // Act
    const document = extractBody('<blockquote><a href="https://example.org/page"></a></blockquote>');

    // Assert
    expect(document.querySelector('a[data-monfil-embed]')).toBeNull();
  });
});

describe('extractArticle site modules', () => {
  test('removes a data-nosnippet block that links to the promoted host among other links', () => {
    // Act
    const document = extractBody(`<div data-nosnippet><p>PROMO ${PARAGRAPH}</p><a href="https://example.org/ok">fine</a><a href="https://4h90.mjlp.lu/x">promo</a></div>`);

    // Assert
    expect(document.body.textContent).not.toContain('PROMO');
  });

  test('removes a data-nosnippet block that links to the promoted host through a protocol-relative link', () => {
    // Act
    const document = extractBody(`<div data-nosnippet><p>PROMO ${PARAGRAPH}</p><a href="//4h90.mjlp.lu/x">promo</a></div>`);

    // Assert
    expect(document.body.textContent).not.toContain('PROMO');
  });

  test.each([
    ['links to another host', '<a href="https://example.org/x">link</a>'],
    ['links to a subdomain of the promoted host', '<a href="https://sub.4h90.mjlp.lu/x">link</a>'],
    ['links to a host that only contains the promoted one in its path', '<a href="https://example.org/4h90.mjlp.lu">link</a>'],
    ['has a link that cannot be parsed', '<a href="http://[broken">link</a>'],
    ['has no link', ''],
  ])('keeps a data-nosnippet block that %s', (_name, content) => {
    // Act
    const document = extractBody(`<div data-nosnippet><p>KEEPME ${PARAGRAPH}</p>${content}</div>`);

    // Assert
    expect(document.body.textContent).toContain('KEEPME');
  });

  test('keeps the story around a removed follow module', () => {
    // Act
    const document = extractBody('<div><p>FOLLOWMODULE</p><ul><li id="follow-author-article_footer-9">Author</li></ul></div><p>AFTERMODULE</p>');

    // Assert
    expect(document.body.textContent).not.toContain('FOLLOWMODULE');
    expect(document.body.textContent).toContain('AFTERMODULE');
  });

  test('keeps an element whose id only contains the follow prefix', () => {
    // Act
    const document = extractBody('<div><p>KEEPFOLLOW</p><ul><li id="my-follow-author-article_footer-9">Author</li></ul></div>');

    // Assert
    expect(document.body.textContent).toContain('KEEPFOLLOW');
  });

  test('keeps a follow control outside a list', () => {
    // Act
    const document = extractBody('<div><p>KEEPLONE</p><span id="follow-author-article_footer-1">Author</span></div>');

    // Assert
    expect(document.body.textContent).toContain('KEEPLONE');
  });

  test.each([
    ['.card-install-pwa', '<div class="card-install-pwa"><p>REMOVEME</p></div>'],
    ['.premium-promo-alert', '<div class="premium-promo-alert"><p>REMOVEME</p></div>'],
    ['[class~="lightbox"]', '<div class="gallery lightbox"><p>REMOVEME</p></div>'],
    ['[role="dialog"]', '<div role="dialog"><p>REMOVEME</p></div>'],
    ['form', '<form><p>REMOVEME</p></form>'],
  ])('removes %s', (_name, markup) => {
    // Act
    const document = extractBody(markup);

    // Assert
    expect(document.body.textContent).not.toContain('REMOVEME');
  });

  test.each([
    ['a product block without the no-ads class', '<div class="product-block"><p>KEEPME</p></div>'],
    ['a class that only starts with modal', '<div class="modality"><p>KEEPME</p></div>'],
    ['a class that only starts with lightbox', '<div class="lightboxes"><p>KEEPME</p></div>'],
  ])('keeps %s', (_name, markup) => {
    // Act
    const document = extractBody(markup);

    // Assert
    expect(document.body.textContent).toContain('KEEPME');
  });
});

describe('extractArticle text', () => {
  test('trims the surrounding whitespace of the text', () => {
    // Act
    const result = extractArticle(articlePage(`<p>\n   FIRST ${PARAGRAPH}</p><p>${PARAGRAPH} LAST   \n</p>`), PAGE);

    // Assert
    expect(result?.text.startsWith('FIRST')).toBe(true);
    expect(result?.text.endsWith('LAST')).toBe(true);
  });

  test('returns undefined when the content holds only whitespace text', () => {
    // Act
    const result = extractArticle('<html><head><title>Photo</title></head><body><article> \n <img src="https://cdn.example.com/s.png" alt="x"> \n </article></body></html>', PAGE);

    // Assert
    expect(result).toBeUndefined();
  });
});

describe('extractArticle word count', () => {
  const WORDS = Array.from({ length: 120 }, (_, index) => `word${index}`);

  test('counts words split by spaces, runs of spaces and newlines', () => {
    // Arrange
    const first = WORDS.slice(0, 40).join(' ');
    const second = WORDS.slice(40, 80).join('  ');
    const third = WORDS.slice(80).join('\n');
    const page = `<html><head><title>Words</title></head><body><article><p>${first}</p>\n<p>${second}</p>\n<p>${third}</p></article></body></html>`;

    // Act
    const result = extractArticle(page, PAGE);

    // Assert
    expect(result?.wordCount).toBe(120);
    expect(result?.text).toMatch(/^word0 /);
    expect(result?.text).toMatch(/word119$/);
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
