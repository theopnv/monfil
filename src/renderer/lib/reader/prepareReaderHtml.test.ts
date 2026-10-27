// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { prepareReaderHtml } from './prepareReaderHtml';

const PAGE = 'https://example.com/posts/one';
const YOUTUBE_ID = 'dQw4w9WgXcQ';
const TWEET_URL = 'https://x.com/someone/status/1234567890';

function prepare(html: string, sourceUrl?: string): Document {
  return new DOMParser().parseFromString(prepareReaderHtml(html, sourceUrl), 'text/html');
}

describe('images', () => {
  test.each([
    ['data-src', '<img data-src="https://cdn.example.com/a.jpg">'],
    ['data-lazy-src', '<img data-lazy-src="https://cdn.example.com/a.jpg">'],
    ['data-original', '<img data-original="https://cdn.example.com/a.jpg">'],
    ['an empty src', '<img src="" data-src="https://cdn.example.com/a.jpg">'],
    ['a data: placeholder src', '<img src="data:image/gif;base64,R0lGOD" data-src="https://cdn.example.com/a.jpg">'],
    ['an about:blank src', '<img src="about:blank" data-src="https://cdn.example.com/a.jpg">'],
  ])('takes the image from %s when the src is missing or a placeholder', (_name, html) => {
    // Act
    const image = prepare(html).querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('https://cdn.example.com/a.jpg');
  });

  test('prefers data-src, then data-lazy-src, then data-original', () => {
    // Act
    const both = prepare('<img data-original="https://c.example/3.jpg" data-lazy-src="https://c.example/2.jpg" data-src="https://c.example/1.jpg">');
    const noSrc = prepare('<img data-original="https://c.example/3.jpg" data-lazy-src="https://c.example/2.jpg">');

    // Assert
    expect(both.querySelector('img')?.getAttribute('src')).toBe('https://c.example/1.jpg');
    expect(noSrc.querySelector('img')?.getAttribute('src')).toBe('https://c.example/2.jpg');
  });

  test('resolves a relative lazy source against the article URL', () => {
    // Act
    const image = prepare('<img data-src="/img/a.jpg">', PAGE).querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('https://example.com/img/a.jpg');
  });

  test('falls back to the first URL of data-srcset, ignoring leading whitespace', () => {
    // Act
    const image = prepare('<img data-srcset="  https://c.example/small.jpg 1x, https://c.example/big.jpg 2x">').querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('https://c.example/small.jpg');
  });

  test.each([
    ['javascript:', 'javascript:alert(1)'],
    ['ftp:', 'ftp://c.example/a.jpg'],
    ['an unparsable URL', 'http://'],
  ])('never takes %s as the lazy source', (_name, lazy) => {
    // Act
    const image = prepare(`<img src="data:image/gif;base64,R0lGOD" data-src="${lazy}">`).querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('data:image/gif;base64,R0lGOD');
  });

  test('does not invent a src when there is no usable source', () => {
    // Act
    const image = prepare('<img alt="x">').querySelector('img');

    // Assert
    expect(image?.hasAttribute('src')).toBe(false);
  });

  test('keeps a real src instead of the lazy source', () => {
    // Act
    const image = prepare('<img src="https://c.example/real.jpg" data-src="https://c.example/lazy.jpg">').querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('https://c.example/real.jpg');
  });

  test('resolves a relative src against the article URL', () => {
    // Act
    const image = prepare('<img src="../img/a.jpg">', PAGE).querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('https://example.com/img/a.jpg');
  });

  test.each([
    ['ftp:', 'ftp://c.example/a.jpg'],
    ['cid:', 'cid:image001@example'],
  ])('removes a %s src, which the reader cannot load, with or without the article URL', (_scheme, src) => {
    // Act
    const withPage = prepare(`<img src="${src}">`, PAGE).querySelector('img');
    const withoutPage = prepare(`<img src="${src}">`).querySelector('img');

    // Assert
    expect(withPage?.hasAttribute('src')).toBe(false);
    expect(withoutPage?.hasAttribute('src')).toBe(false);
  });

  test('keeps an inline data image that has no lazy source', () => {
    // Act
    const image = prepare('<img src="data:image/png;base64,iVBORw0KGgo=">', PAGE).querySelector('img');

    // Assert
    expect(image?.getAttribute('src')).toBe('data:image/png;base64,iVBORw0KGgo=');
  });

  test('leaves a src alone when the article URL is unknown', () => {
    // Act
    const absolute = prepare('<img src="https://Example.com/a b.jpg">').querySelector('img');
    const relative = prepare('<img src="/img/a.jpg">').querySelector('img');

    // Assert
    expect(absolute?.getAttribute('src')).toBe('https://Example.com/a b.jpg');
    expect(relative?.getAttribute('src')).toBe('/img/a.jpg');
  });

  test('reads only a scheme at the start of a src when the article URL is unknown', () => {
    // Act
    const colonInPath = prepare('<img src="img/a:b.jpg">').querySelector('img');
    const schemeWithDigit = prepare('<img src="web+x1:a.jpg">').querySelector('img');

    // Assert
    expect(colonInPath?.getAttribute('src')).toBe('img/a:b.jpg');
    expect(schemeWithDigit?.hasAttribute('src')).toBe(false);
  });

  test('copies data-srcset to srcset', () => {
    // Act
    const image = prepare('<img src="https://c.example/a.jpg" data-srcset="https://c.example/a.jpg 1x, https://c.example/b.jpg 2x">').querySelector('img');

    // Assert
    expect(image?.getAttribute('srcset')).toBe('https://c.example/a.jpg 1x, https://c.example/b.jpg 2x');
  });

  test('keeps an existing srcset', () => {
    // Act
    const image = prepare('<img src="https://c.example/a.jpg" srcset="https://c.example/own.jpg 1x" data-srcset="https://c.example/lazy.jpg 1x">').querySelector('img');

    // Assert
    expect(image?.getAttribute('srcset')).toBe('https://c.example/own.jpg 1x');
  });

  test('adds no srcset when there is no data-srcset', () => {
    // Act
    const image = prepare('<img src="https://c.example/a.jpg">').querySelector('img');

    // Assert
    expect(image?.hasAttribute('srcset')).toBe(false);
  });

  test('copies data-srcset to srcset on the sources of a picture', () => {
    // Act
    const sources = prepare(
      '<picture><source data-srcset="https://c.example/a.webp 1x"><source srcset="https://c.example/own.webp 1x" data-srcset="https://c.example/lazy.webp 1x"><img src="https://c.example/a.jpg"></picture>',
    ).querySelectorAll('source');

    // Assert
    expect(sources[0]?.getAttribute('srcset')).toBe('https://c.example/a.webp 1x');
    expect(sources[1]?.getAttribute('srcset')).toBe('https://c.example/own.webp 1x');
  });
});

describe('iframes', () => {
  test('turns a known embed into a marker link that carries the canonical source URL', () => {
    // Act
    const document = prepare(`<p>before</p><iframe src="https://www.youtube.com/embed/${YOUTUBE_ID}" title="  A talk  "></iframe>`);

    // Assert
    const marker = document.querySelector('a[data-monfil-embed]');
    expect(document.querySelector('iframe')).toBeNull();
    expect(marker?.getAttribute('data-monfil-embed')).toBe('youtube');
    expect(marker?.getAttribute('href')).toBe(`https://www.youtube.com/watch?v=${YOUTUBE_ID}`);
    expect(marker?.textContent).toBe('A talk');
  });

  test.each([
    ['has no title', ''],
    ['has a blank title', ' title="   "'],
  ])('names the marker after its provider when the iframe %s', (_name, titleAttribute) => {
    // Act
    const marker = prepare(`<iframe src="https://player.vimeo.com/video/76979871"${titleAttribute}></iframe>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('data-monfil-embed')).toBe('vimeo');
    expect(marker?.textContent).toBe('vimeo embed');
  });

  test('reads the embed from data-src before src', () => {
    // Act
    const marker = prepare(`<iframe src="about:blank" data-src="https://www.youtube.com/embed/${YOUTUBE_ID}"></iframe>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('data-monfil-embed')).toBe('youtube');
  });

  test('resolves an embed URL that is relative to the article', () => {
    // Act
    const marker = prepare('<iframe src="//player.vimeo.com/video/76979871"></iframe>', PAGE).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('href')).toBe('https://vimeo.com/76979871');
  });

  test('turns an unknown https iframe into a plain link with its title', () => {
    // Act
    const document = prepare('<iframe src="https://other.example/widget" title="  Chart  "></iframe>');

    // Assert
    const link = document.querySelector('a');
    expect(document.querySelector('iframe')).toBeNull();
    expect(link?.getAttribute('href')).toBe('https://other.example/widget');
    expect(link?.hasAttribute('data-monfil-embed')).toBe(false);
    expect(link?.textContent).toBe('Chart');
  });

  test.each([
    ['has no title', ''],
    ['has a blank title', ' title="  "'],
  ])('labels a link to unknown content "Open embedded content" when the iframe %s', (_name, titleAttribute) => {
    // Act
    const link = prepare(`<iframe src="http://other.example/widget"${titleAttribute}></iframe>`).querySelector('a');

    // Assert
    expect(link?.getAttribute('href')).toBe('http://other.example/widget');
    expect(link?.textContent).toBe('Open embedded content');
  });

  test('resolves a relative iframe URL against the article', () => {
    // Act
    const link = prepare('<iframe src="/widgets/chart"></iframe>', PAGE).querySelector('a');

    // Assert
    expect(link?.getAttribute('href')).toBe('https://example.com/widgets/chart');
  });

  test.each([
    ['a javascript: URL', '<iframe src="javascript:alert(1)"></iframe>'],
    ['a data: URL', '<iframe src="data:text/html,<script>alert(1)</script>"></iframe>'],
    ['no src', '<iframe></iframe>'],
    ['an empty src', '<iframe src=""></iframe>'],
    ['a srcdoc only', '<iframe srcdoc="<script>alert(1)</script>"></iframe>'],
  ])('drops an iframe with %s and leaves no link behind', (_name, html) => {
    // Act
    const document = prepare(`<p>text</p>${html}`);

    // Assert
    expect(document.body.innerHTML).toBe('<p>text</p>');
  });

  test('does not turn an http-only embed host into a marker', () => {
    // Act
    const document = prepare(`<iframe src="http://www.youtube.com/embed/${YOUTUBE_ID}"></iframe>`);

    // Assert
    expect(document.querySelector('a[data-monfil-embed]')).toBeNull();
    expect(document.querySelector('a')?.getAttribute('href')).toBe(`http://www.youtube.com/embed/${YOUTUBE_ID}`);
  });
});

describe('blockquotes', () => {
  test('turns a twitter-tweet blockquote into a marker for the tweet it links to', () => {
    // Act
    const document = prepare(`<blockquote class="twitter-tweet"><p>Some words</p><a href="https://example.com/x">other</a><a href="${TWEET_URL}?ref_src=a">link</a></blockquote>`);

    // Assert
    const marker = document.querySelector('a[data-monfil-embed]');
    expect(document.querySelector('blockquote')).toBeNull();
    expect(marker?.getAttribute('data-monfil-embed')).toBe('x');
    expect(marker?.getAttribute('href')).toBe(TWEET_URL);
    expect(marker?.textContent).toBe('x embed');
  });

  test('turns an instagram-media blockquote into a marker for its permalink', () => {
    // Act
    const document = prepare('<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/ABCDE12345/?utm_source=x"><p>caption</p></blockquote>');

    // Assert
    const marker = document.querySelector('a[data-monfil-embed]');
    expect(document.querySelector('blockquote')).toBeNull();
    expect(marker?.getAttribute('data-monfil-embed')).toBe('instagram');
    expect(marker?.getAttribute('href')).toBe('https://www.instagram.com/p/ABCDE12345/');
  });

  test('prefers the instagram permalink over the links inside', () => {
    // Act
    const marker = prepare(`<blockquote class="instagram-media" data-instgrm-permalink="https://www.instagram.com/p/ABCDE12345/"><a href="${TWEET_URL}">t</a></blockquote>`).querySelector('a[data-monfil-embed]');

    // Assert
    expect(marker?.getAttribute('data-monfil-embed')).toBe('instagram');
  });

  test.each([
    ['an empty blockquote', `<blockquote><a href="${TWEET_URL}"></a></blockquote>`],
    ['a blockquote with only whitespace', `<blockquote>  \n <a href="${TWEET_URL}"></a> </blockquote>`],
    ['a tweet quoted inside a figure', `<figure><blockquote><p>quoted</p><a href="${TWEET_URL}">l</a></blockquote></figure>`],
  ])('turns %s that links to a tweet into a marker', (_name, html) => {
    // Act
    const document = prepare(html);

    // Assert
    expect(document.querySelector('blockquote')).toBeNull();
    expect(document.querySelector('a[data-monfil-embed]')?.getAttribute('href')).toBe(TWEET_URL);
  });

  test.each([
    ['a plain quote that mentions a tweet', `<blockquote><p>As said</p><a href="${TWEET_URL}">here</a></blockquote>`],
    ['a quote with a youtube link inside a figure', `<figure><blockquote><p>watch</p><a href="https://www.youtube.com/watch?v=${YOUTUBE_ID}">v</a></blockquote></figure>`],
    ['a twitter-tweet quote with no embeddable link', '<blockquote class="twitter-tweet"><p>text</p><a href="https://example.com/x">l</a></blockquote>'],
    ['an empty quote with no link', '<blockquote></blockquote>'],
    ['an instagram-media quote with a link that is not embeddable', '<blockquote class="instagram-media"><a href="https://example.com/p/ABCDE12345/">l</a></blockquote>'],
  ])('keeps %s as a quote', (_name, html) => {
    // Act
    const document = prepare(html);

    // Assert
    expect(document.querySelector('blockquote')).not.toBeNull();
    expect(document.querySelector('a[data-monfil-embed]')).toBeNull();
  });

});

describe('site chrome', () => {
  test('removes the follow-author footer block that wraps the list', () => {
    // Act
    const document = prepare('<div class="wrap"><ul><li><a id="follow-author-article_footer-3" href="/f">Follow</a></li></ul></div><p>Body</p>');

    // Assert
    expect(document.body.innerHTML).toBe('<p>Body</p>');
  });

  test('keeps the rest of the article when the follow-author list is a top-level element', () => {
    // Act
    const document = prepare('<ul><li><a id="follow-author-article_footer-3" href="/f">Follow</a></li></ul><p>Body</p>');

    // Assert
    expect(document.body.innerHTML).toBe('<p>Body</p>');
  });

  test('removes a nosnippet block that links to the ad domain, however the link is written', () => {
    // Act
    const document = prepare(
      '<div data-nosnippet><a href="/page">one</a><a href="https://4h90.mjlp.lu/ad">ad</a></div>'
      + '<div data-nosnippet><a href="//4h90.mjlp.lu/other">ad</a></div>'
      + '<p>Body</p>',
      PAGE,
    );

    // Assert
    expect(document.body.innerHTML).toBe('<p>Body</p>');
  });

  test.each([
    ['links to another host', '<div data-nosnippet=""><a href="https://other.example/ad">x</a></div>'],
    ['links to a lookalike host', '<div data-nosnippet=""><a href="https://4h90.mjlp.lu.evil.example/ad">x</a></div>'],
    ['has no links', '<div data-nosnippet="">x</div>'],
    ['links to the ad domain without being marked nosnippet', '<div><a href="https://4h90.mjlp.lu/ad">x</a></div>'],
  ])('keeps a block that %s', (_name, html) => {
    // Act
    const document = prepare(html, PAGE);

    // Assert
    expect(document.body.innerHTML).toBe(html);
  });

  test('judges a nosnippet link by its own host, not the article host', () => {
    // Act
    const document = prepare('<div data-nosnippet><a href="https://4h90.mjlp.lu/ad">x</a></div>', 'https://other.example/post');

    // Assert
    expect(document.querySelector('[data-nosnippet]')).toBeNull();
  });

  test('keeps a nosnippet block whose link cannot be parsed', () => {
    // Act
    const document = prepare('<div data-nosnippet><a href="http://">x</a></div>');

    // Assert
    expect(document.querySelector('[data-nosnippet]')).not.toBeNull();
  });

  test.each([
    ['a form', '<form action="/s"><input name="q"></form>'],
    ['the PWA install banner', '<div id="installPwaDiv">Install</div>'],
    ['the PWA install card', '<div class="card-install-pwa">Install</div>'],
    ['a no-ads product block', '<div class="product-block optid-no-ads">Buy</div>'],
    ['a premium promo alert', '<div class="premium-promo-alert">Go premium</div>'],
    ['an embed consent overlay', '<div class="embed-consent-overlay">Consent</div>'],
    ['a lightbox', '<div class="gallery lightbox">Zoom</div>'],
    ['a modal', '<div class="modal fade">Pop</div>'],
    ['a dialog', '<div role="dialog">Pop</div>'],
  ])('removes %s', (_name, html) => {
    // Act
    const document = prepare(`<p>Body</p>${html}`);

    // Assert
    expect(document.body.innerHTML).toBe('<p>Body</p>');
  });

  test('keeps an element whose class only contains the word modal or lightbox', () => {
    // Arrange
    const html = '<div class="modality">a</div><div class="lightboxed">b</div>';

    // Act
    const document = prepare(html);

    // Assert
    expect(document.body.innerHTML).toBe(html);
  });

  test('returns ordinary markup unchanged', () => {
    // Arrange
    const html = '<h2>Title</h2><p>Some <em>text</em> and a <a href="https://example.com/a">link</a>.</p>';

    // Act
    const result = prepareReaderHtml(html, PAGE);

    // Assert
    expect(result).toBe(html);
  });
});
