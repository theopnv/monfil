// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { decode, EntityLevel } from 'entities';

// Job feeds are flat and regular, so reading tags directly is enough here and spares a parser dependency.
// The tag name is always a literal from this codebase, never feed content.

function escapeRegex(tag: string): string {
  return tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** The inner text of every `<tag>…</tag>` element in `xml`, raw. */
export function blocks(xml: string, tag: string): string[] {
  const name = escapeRegex(tag);
  const pattern = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g');
  // Stryker disable next-line StringLiteral: the pattern always captures its group, so the fallback is never read
  return [...xml.matchAll(pattern)].map((match) => match[1] ?? '');
}

/** Element text with CDATA unwrapped and entities decoded. Undefined when empty. */
export function plain(raw: string): string | undefined {
  const cdata = /^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/.exec(raw);
  // Stryker disable next-line StringLiteral: the pattern always captures its group, so the fallback is never read
  const text = (cdata ? cdata[1] ?? '' : decode(raw, EntityLevel.XML)).trim();
  return text === '' ? undefined : text;
}

/** The text of the first `<tag>`. Undefined when absent or empty. */
export function textOf(xml: string, tag: string): string | undefined {
  const [first] = blocks(xml, tag);
  return first === undefined ? undefined : plain(first);
}
