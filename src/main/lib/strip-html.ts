// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { decode, EntityLevel } from 'entities';

// <style>/<script> content never renders as text; Blogger/Blogspot feeds in particular embed a
// <style> block ahead of the article body, which would otherwise leak into the stripped output.
const STYLE_SCRIPT_REGEX = /<(style|script)\b[^>]*>[\s\S]*?<\/\1>/gi;
const TAG_REGEX = /<[^>]*>/g;

// Some feeds put literal entities like "&#8217;" inside a CDATA section, where XML parsers
// leave them untouched by spec. Decode them so titles and descriptions render as text.
export function decodeText(text: string): string {
  return decode(text, EntityLevel.HTML);
}

/** Applies `pattern` until the text stops changing, so a removal cannot splice a new match together. `pattern` must be global. */
export function removeAll(text: string, pattern: RegExp, replacement = ''): string {
  let previous: string;
  let current = text;
  do {
    previous = current;
    current = current.replace(pattern, replacement);
  } while (current !== previous);
  return current;
}

export function stripHtml(html: string): string {
  // Entities must be decoded before tag stripping: decoding afterwards would turn
  // entity-encoded markup (e.g. `&lt;script&gt;`) into live tags that already skipped removal.
  const decoded = decodeText(html);
  const withoutStyleScript = removeAll(decoded, STYLE_SCRIPT_REGEX);
  const withoutTags = removeAll(withoutStyleScript, TAG_REGEX);
  // An unterminated tag (no closing `>`) never matches TAG_REGEX, so any leftover `<` is dropped directly.
  const withoutStrayBrackets = withoutTags.replace(/</g, '');
  return withoutStrayBrackets.replace(/\s+/g, ' ').trim();
}

export function truncateOnWordBoundary(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const truncated = trimmed.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const boundary = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${boundary.trimEnd()}…`;
}
