// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

// Chinese and Japanese put no spaces between words, so a space count would read a whole article as one word. U+30FC, the prolonged sound mark, belongs to no script on its own.
const UNSPACED_SCRIPT = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\u30fc]/gu;

// Their punctuation and full-width forms would otherwise stand alone as words.
const UNSPACED_PUNCTUATION = /[\u3000-\u303f\uff00-\uffef]/gu;

// Two characters read about as fast as one word of a spaced language.
const CHARACTERS_PER_WORD = 2;

/** Counts the words of a text. A Han, Hiragana, or Katakana character counts for half a word. */
export function countWords(text: string): number {
  const unspaced = text.match(UNSPACED_SCRIPT)?.length ?? 0;
  // Stryker disable next-line MethodExpression,Regex: blank pieces from edge or repeated whitespace are removed by filter(Boolean)
  const spaced = text.replace(UNSPACED_SCRIPT, ' ').replace(UNSPACED_PUNCTUATION, ' ').trim().split(/\s+/).filter(Boolean).length;
  return spaced + Math.ceil(unspaced / CHARACTERS_PER_WORD);
}
