// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { decodeText } from './text';

const FEED_TYPES = new Set(['application/rss+xml', 'application/atom+xml', 'application/feed+json', 'application/json']);
const PROBE_PATHS = ['/feed', '/rss.xml', '/atom.xml', '/index.xml', '/feed.xml'];
const LINK_TAG_REGEX = /<link\b[^>]*>/gi;
const HEAD_END_REGEX = /<\/head\s*>|<body\b/i;
const ATTRIBUTE_REGEX = /([\w-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/g;

function readAttributes(tag: string): Map<string, string> {
  const attributes = new Map<string, string>();
  for (const match of tag.matchAll(ATTRIBUTE_REGEX)) {
    const [, name, doubleQuoted, singleQuoted, bare] = match;
    if (name) {
      // Stryker disable next-line StringLiteral: one of the three captures is always set, so the fallback never applies
      attributes.set(name.toLowerCase(), decodeText(doubleQuoted ?? singleQuoted ?? bare ?? ''));
    }
  }
  return attributes;
}

/**
 * The feed URLs a page advertises with `<link rel="alternate">`, in page order and without duplicates.
 * Regexes, not a DOM: only `<link>` tags in the head count, because page content such as comments can
 * add tags to the body, and the page is untrusted.
 * @param baseUrl the page's own URL, which relative `href`s resolve against
 */
export function findAlternateLinks(html: string, baseUrl: string): string[] {
  const headEnd = html.search(HEAD_END_REGEX);
  const head = headEnd === -1 ? html : html.slice(0, headEnd);
  const links: string[] = [];
  for (const [tag] of head.matchAll(LINK_TAG_REGEX)) {
    const attributes = readAttributes(tag);
    // Stryker disable next-line Regex,ArrayDeclaration: an extra space or a stand-in token only adds an entry that is not 'alternate'
    const rel = attributes.get('rel')?.toLowerCase().split(/\s+/) ?? [];
    const type = attributes.get('type')?.toLowerCase().split(';')[0]?.trim();
    const href = attributes.get('href');
    if (!rel.includes('alternate') || !type || !FEED_TYPES.has(type) || !href) {
      continue;
    }
    try {
      const resolved = new URL(href, baseUrl);
      if ((resolved.protocol === 'http:' || resolved.protocol === 'https:') && !links.includes(resolved.href)) {
        links.push(resolved.href);
      }
      // Stryker disable next-line BlockStatement: the catch is the last statement of the loop body, so an empty block moves on the same way
    } catch {
      continue;
    }
  }
  return links;
}

/** The common feed paths to try on a page's origin when it advertises no feed. */
export function probeLinks(pageUrl: string): string[] {
  const { origin } = new URL(pageUrl);
  return PROBE_PATHS.map((path) => `${origin}${path}`);
}
