// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { resolveEmbedUrl, type EmbedDescriptor } from '../../../shared/embeds';

function httpUrl(value: string | null, baseUrl?: string): string | undefined {
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

function marker(document: Document, embed: EmbedDescriptor, title?: string | null): HTMLAnchorElement {
  const anchor = document.createElement('a');
  anchor.href = embed.sourceUrl;
  anchor.setAttribute('data-monfil-embed', embed.provider);
  anchor.textContent = title?.trim() || `${embed.provider} embed`;
  return anchor;
}

export function prepareReaderHtml(html: string, sourceUrl?: string): string {
  const document = new DOMParser().parseFromString(html, 'text/html');

  for (const image of document.querySelectorAll('img')) {
    const current = image.getAttribute('src');
    const lazy = image.getAttribute('data-src') ?? image.getAttribute('data-lazy-src') ?? image.getAttribute('data-original');
    if (!current || current.startsWith('data:') || current === 'about:blank') {
      const lazySet = image.getAttribute('data-srcset');
      const source = httpUrl(lazy, sourceUrl) ?? httpUrl(lazySet?.match(/^\s*(\S+)/)?.[1] ?? null, sourceUrl);
      if (source) {
        image.setAttribute('src', source);
      }
    } else if (sourceUrl) {
      const source = httpUrl(current, sourceUrl);
      if (source) {
        image.setAttribute('src', source);
      }
    }
    const lazySet = image.getAttribute('data-srcset');
    if (!image.hasAttribute('srcset') && lazySet) {
      image.setAttribute('srcset', lazySet);
    }
  }

  for (const source of document.querySelectorAll('picture source[data-srcset]')) {
    if (!source.hasAttribute('srcset')) {
      source.setAttribute('srcset', source.getAttribute('data-srcset') ?? '');
    }
  }

  for (const frame of [...document.querySelectorAll('iframe')]) {
    const rawUrl = frame.getAttribute('data-src') ?? frame.getAttribute('src');
    const embed = rawUrl ? resolveEmbedUrl(rawUrl, sourceUrl) : undefined;
    if (embed) {
      frame.replaceWith(marker(document, embed, frame.getAttribute('title')));
      continue;
    }
    const source = httpUrl(rawUrl, sourceUrl);
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
      ?? [...quote.querySelectorAll('a[href]')].map((link) => link.getAttribute('href')).find((href) => href && resolveEmbedUrl(href, sourceUrl));
    const embed = source ? resolveEmbedUrl(source, sourceUrl) : undefined;
    const isEmbed = quote.classList.contains('twitter-tweet') || quote.classList.contains('instagram-media')
      || quote.textContent?.trim() === '' || (embed?.provider === 'x' && quote.closest('figure') !== null);
    if (embed && isEmbed) {
      quote.replaceWith(marker(document, embed));
    }
  }

  for (const control of document.querySelectorAll('[id^="follow-author-article_footer"]')) {
    control.closest('ul')?.parentElement?.remove();
  }
  for (const block of document.querySelectorAll('[data-nosnippet]')) {
    if ([...block.querySelectorAll('a[href]')].some((link) => {
      try {
        return new URL(link.getAttribute('href') ?? '', sourceUrl).hostname === '4h90.mjlp.lu';
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

  return document.body.innerHTML;
}
