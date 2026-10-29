// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createHash } from 'node:crypto';
import { decode, EntityLevel } from 'entities';

// Some feeds put literal entities like "&#8217;" inside a CDATA section, where XML parsers
// leave them untouched by spec. Decode them here so titles and descriptions render as text.
export function decodeText(text: string): string {
  return decode(text, EntityLevel.HTML);
}

const LINE_BREAK_TAG_REGEX = /<br\b[^>]*>/gi;
// Only known element names, so a title like "Vector<T>" keeps its brackets.
const TITLE_TAG_REGEX = /<\/?(?:a|abbr|b|big|cite|code|del|div|em|font|h[1-6]|i|img|ins|kbd|mark|p|q|s|samp|small|span|strike|strong|sub|sup|time|tt|u|var|wbr)\b[^>]*>/gi;

/** Decodes a title and removes the HTML tags that some feeds put in it, though titles are plain text. */
export function decodeTitle(text: string): string {
  const withoutTags = removeAll(decodeText(text).replace(LINE_BREAK_TAG_REGEX, ' '), TITLE_TAG_REGEX);
  return withoutTags.replace(/\s+/g, ' ').trim();
}

export function decodeOptional(text: string | undefined): string | undefined {
  return text === undefined ? undefined : decodeText(text);
}

// Every item needs an identity, and a feed may supply neither a guid nor a link, so fall back to a
// digest of the fields that are always there. The prefix keeps it clear of real guids.
export function resolveGuid(guid: string | undefined, link: string | undefined, title: string, pubDate: string): string {
  if (guid) {
    return guid;
  }
  if (link) {
    return link;
  }
  return `monfil:hash:${createHash('sha1').update(`${title} ${pubDate}`).digest('hex')}`;
}

export function escapeText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/**
 * Applies `pattern` until the text stops changing, so a removal cannot splice a new match together.
 * @param pattern must be global
 */
export function removeAll(text: string, pattern: RegExp, replacement = ''): string {
  let previous: string;
  let current = text;
  do {
    previous = current;
    current = current.replace(pattern, replacement);
  } while (current !== previous);
  return current;
}
