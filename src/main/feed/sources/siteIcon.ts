// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { fetchText } from '../../lib/fetch';
import { ARTICLE_FETCH_TIMEOUT_MS } from '../../lib/constants';

const LINK_TAG_REGEX = /<link\b[^>]*>/gi;
const REL_REGEX = /\brel\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const HREF_REGEX = /\bhref\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i;
const SIZES_REGEX = /\bsizes\s*=\s*["']?([^"'>]+)/i;
const DARK_MEDIA_REGEX = /\bmedia\s*=\s*["'][^"']*prefers-color-scheme:\s*dark/i;
const APPLE_TOUCH_ICON_SIZE = 180;
const SCALABLE_ICON_SIZE = 512;
const FETCH_OPTIONS = { timeoutMs: ARTICLE_FETCH_TIMEOUT_MS, blockPrivateHosts: true };

interface IconLink {
  href: string;
  score: number;
}

function attribute(tag: string, regex: RegExp): string | undefined {
  const match = regex.exec(tag);
  return match ? match[1] ?? match[2] ?? match[3] : undefined;
}

function isIconRel(rel: string): boolean {
  return rel.toLowerCase().split(/\s+/).some((token) => token === 'icon' || token.startsWith('apple-touch-icon'));
}

function declaredSize(tag: string, rel: string, href: string): number {
  const sizes = SIZES_REGEX.exec(tag)?.[1]?.toLowerCase();
  if (sizes === 'any' || (!sizes && /\.svg(?:$|[?#])/i.test(href))) {
    return SCALABLE_ICON_SIZE;
  }
  const widths = (sizes ?? '').split(/\s+/).map((size) => Number.parseInt(size, 10)).filter(Number.isFinite);
  if (widths.length > 0) {
    return Math.max(...widths);
  }
  return rel.toLowerCase().includes('apple-touch-icon') ? APPLE_TOUCH_ICON_SIZE : 0;
}

function toIconLink(tag: string, pageUrl: string): IconLink | undefined {
  const rel = attribute(tag, REL_REGEX);
  const raw = attribute(tag, HREF_REGEX);
  if (!rel || !raw || !isIconRel(rel)) {
    return undefined;
  }
  let href: URL;
  try {
    href = new URL(raw.trim(), pageUrl);
  } catch {
    return undefined;
  }
  const isImageData = href.protocol === 'data:' && href.pathname.startsWith('image/');
  if (href.protocol !== 'http:' && href.protocol !== 'https:' && !isImageData) {
    return undefined;
  }
  // A dark-scheme variant is drawn for a dark page and can vanish on the app's light surfaces.
  const score = DARK_MEDIA_REGEX.test(tag) ? -1 : declaredSize(tag, rel, href.href);
  return { href: href.href, score };
}

/**
 * Reads the icons a page declares with `<link rel="icon">` or `apple-touch-icon`, best first.
 * @param html the page markup
 * @param pageUrl the page address, which relative icon links resolve against
 * @returns absolute http(s) or `data:image` URLs, largest first and dark-scheme variants last
 */
export function extractIconLinks(html: string, pageUrl: string): string[] {
  const links = (html.match(LINK_TAG_REGEX) ?? []).flatMap((tag) => toIconLink(tag, pageUrl) ?? []);
  return links.sort((a, b) => b.score - a.score).map((link) => link.href);
}

async function responds(url: string): Promise<boolean> {
  const result = await fetchText(url, FETCH_OPTIONS);
  return result.success;
}

async function declaredIcon(siteUrl: URL): Promise<string | undefined> {
  const page = await fetchText(siteUrl.href, FETCH_OPTIONS);
  return page.success ? extractIconLinks(page.data.body, siteUrl.href)[0] : undefined;
}

/**
 * Finds the icon of the site behind a feed: the one its page declares, else `/favicon.ico`, else
 * DuckDuckGo's copy. Each fallback must answer 2xx, so a placeholder is never returned.
 * @param siteLink the site's home or section page, as the feed names it
 * @returns the icon URL, or undefined when the site has none
 */
export async function resolveSiteIcon(siteLink: string): Promise<string | undefined> {
  let siteUrl: URL;
  try {
    siteUrl = new URL(siteLink);
  } catch {
    return undefined;
  }
  if (siteUrl.protocol !== 'http:' && siteUrl.protocol !== 'https:') {
    return undefined;
  }
  try {
    const declared = await declaredIcon(siteUrl);
    if (declared) {
      return declared;
    }
    const favicon = new URL('/favicon.ico', siteUrl).href;
    if (await responds(favicon)) {
      return favicon;
    }
    // DuckDuckGo answers 404 with a grey placeholder image for a site it has no icon for.
    const service = `https://icons.duckduckgo.com/ip3/${siteUrl.hostname}.ico`;
    return await responds(service) ? service : undefined;
  } catch {
    return undefined;
  }
}
