// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Readability } from '@mozilla/readability';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import type { ArticleContentStatus } from '../db/types';
import { SANITIZE_CONFIG } from '../../shared/sanitize-html';
import { resolveEmbedUrl, type EmbedDescriptor } from '../../shared/embeds';
import { MIN_ARTICLE_LENGTH } from '../constants';

export interface ExtractedArticle {
  html: string;
  text: string;
  wordCount: number;
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function httpUrl(value: string | null, baseUrl: string): string | undefined {
  if (!value) {
    return undefined;
  }
  try {
    const url = new URL(value, baseUrl);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : undefined;
  } catch {
    return undefined;
  }
}

function prepareImages(document: Document, baseUrl: string): void {
  for (const image of document.querySelectorAll('img')) {
    const current = image.getAttribute('src');
    const lazy = image.getAttribute('data-src') ?? image.getAttribute('data-lazy-src') ?? image.getAttribute('data-original');
    const lazySet = image.getAttribute('data-srcset');
    if (!current || current.startsWith('data:') || current === 'about:blank') {
      const source = httpUrl(lazy, baseUrl) ?? httpUrl(lazySet?.match(/^\s*(\S+)/)?.[1] ?? null, baseUrl);
      if (source) {
        image.setAttribute('src', source);
      }
    }
    if (!image.hasAttribute('srcset') && lazySet) {
      image.setAttribute('srcset', lazySet);
    }
  }
  for (const source of document.querySelectorAll('picture source[data-srcset]')) {
    if (!source.hasAttribute('srcset')) {
      source.setAttribute('srcset', source.getAttribute('data-srcset') ?? '');
    }
  }
}

function removeSiteModules(document: Document): void {
  for (const control of document.querySelectorAll('[id^="follow-author-article_footer"]')) {
    const list = control.closest('ul');
    list?.parentElement?.remove();
  }
  for (const block of document.querySelectorAll('[data-nosnippet]')) {
    if ([...block.querySelectorAll('a[href]')].some((link) => {
      try {
        return new URL(link.getAttribute('href') ?? '', document.baseURI).hostname === '4h90.mjlp.lu';
      } catch {
        return false;
      }
    })) {
      block.remove();
    }
  }
  for (const element of document.querySelectorAll('form, #installPwaDiv, .card-install-pwa, .product-block.optid-no-ads, .premium-promo-alert, .embed-consent-overlay, [class~="lightbox"], [class~="modal"], [role="dialog"]')) {
    element.remove();
  }
}

function embedMarker(document: Document, embed: EmbedDescriptor, title?: string | null): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.setAttribute('data-monfil-embed', embed.provider);
  anchor.href = embed.sourceUrl;
  anchor.textContent = title?.trim() || `${embed.provider} embed`;
  return anchor;
}

function prepareEmbeds(document: Document, baseUrl: string): void {
  for (const frame of [...document.querySelectorAll('iframe')]) {
    const rawUrl = frame.getAttribute('data-src') ?? frame.getAttribute('src');
    const embed = rawUrl ? resolveEmbedUrl(rawUrl, baseUrl) : undefined;
    if (embed) {
      frame.replaceWith(embedMarker(document, embed, frame.getAttribute('title')));
      continue;
    }
    const source = httpUrl(rawUrl, baseUrl);
    if (source) {
      const link = document.createElement('a');
      link.href = source;
      link.textContent = frame.getAttribute('title')?.trim() || 'Open embedded content';
      frame.replaceWith(link);
    } else {
      frame.remove();
    }
  }

  for (const quote of [...document.querySelectorAll('blockquote')]) {
    const source = quote.getAttribute('data-instgrm-permalink')
      ?? [...quote.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')).find((href) => href && resolveEmbedUrl(href, baseUrl));
    const embed = source ? resolveEmbedUrl(source, baseUrl) : undefined;
    const isEmbed = quote.classList.contains('twitter-tweet') || quote.classList.contains('instagram-media')
      || quote.textContent?.trim() === '' || (embed?.provider === 'x' && quote.closest('figure') !== null);
    if (embed && isEmbed) {
      quote.replaceWith(embedMarker(document, embed));
    }
  }
}

/**
 * Runs Readability over a fetched page and sanitizes the result.
 * @param pageHtml the raw HTML of the article page
 * @param url the page's URL, used to resolve relative links and image sources in the extracted markup
 * @returns the extracted article, or `undefined` when Readability finds no content
 */
export function extractArticle(pageHtml: string, url: string): ExtractedArticle | undefined {
  // `url` sets `document.baseURI`/`documentURI`, which is what Readability resolves relative
  // links and image sources against. Scripts and external resources are never fetched or run:
  // jsdom's `runScripts`/`resources` options are left at their safe (disabled) defaults.
  const dom = new JSDOM(pageHtml, { url });
  prepareImages(dom.window.document, url);
  removeSiteModules(dom.window.document);
  const article = new Readability(dom.window.document).parse();
  if (!article?.content || !article.textContent?.trim()) {
    return undefined;
  }

  const contentDom = new JSDOM(article.content, { url });
  prepareEmbeds(contentDom.window.document, url);
  const purify = createDOMPurify(dom.window);
  const html = purify.sanitize(contentDom.window.document.body.innerHTML, SANITIZE_CONFIG);
  const text = new JSDOM(html).window.document.body.textContent?.trim() ?? '';

  return { html, text, wordCount: countWords(text) };
}

export function deriveArticleContentStatus(article: ExtractedArticle | undefined): ArticleContentStatus {
  if (!article) {
    return 'failed';
  }
  return article.text.length < MIN_ARTICLE_LENGTH ? 'too_short' : 'ok';
}
