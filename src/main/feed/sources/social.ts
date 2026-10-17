// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { decodeText, removeAll } from './text';
import type { ParsedFeedContent } from './types';

const MAX_TITLE_LENGTH = 100;
const BLOCK_BREAK_REGEX = /<br\s*\/?>|<\/(?:p|div|li|h[1-6]|blockquote)>/gi;
const TAG_REGEX = /<[^>]*>/g;

/**
 * A title for a post that has none: the first line of its text, cut on a word break.
 * @param description the post body, as HTML or plain text
 */
export function postTitle(description: string): string {
  const text = decodeText(removeAll(description.replace(BLOCK_BREAK_REGEX, '\n'), TAG_REGEX));
  const firstLine = text.split('\n').map((line) => line.replace(/\s+/g, ' ').trim()).find((line) => line.length > 0);
  if (!firstLine) {
    return 'Post';
  }
  // Code points, so a cut never splits a surrogate pair.
  const characters = Array.from(firstLine);
  if (characters.length <= MAX_TITLE_LENGTH) {
    return firstLine;
  }
  const head = characters.slice(0, MAX_TITLE_LENGTH).join('');
  const lastSpace = head.lastIndexOf(' ');
  return `${(lastSpace > MAX_TITLE_LENGTH / 2 ? head.slice(0, lastSpace) : head).trimEnd()}…`;
}

/** Social posts carry no `<title>`, so every item gets one made from its text. */
export function titlePosts(content: ParsedFeedContent): ParsedFeedContent {
  return { ...content, items: content.items.map((item) => ({ ...item, title: postTitle(item.description) })) };
}
