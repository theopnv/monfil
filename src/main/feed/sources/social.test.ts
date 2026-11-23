// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { postTitle } from './social';

describe('postTitle', () => {

  test('strips HTML and treats paragraph breaks as lines', () => {
    // Act / Assert
    expect(postTitle('<p>New <a href="https://x.test/tags/a">#<span>Plushtodon</span></a> colours!</p><p>Second</p>')).toBe('New #Plushtodon colours!');
  });

  test('cuts back to the last word break when the cut falls inside a word', () => {
    // Arrange
    const long = 'abcdefg '.repeat(15);

    // Act
    const title = postTitle(long);

    // Assert
    expect(title).toBe(`${'abcdefg '.repeat(12).trim()}…`);
  });

  test.each([
    ['at half the length, so it keeps the characters', `${'a'.repeat(50)} ${'b'.repeat(60)}`, `${'a'.repeat(50)} ${'b'.repeat(49)}…`],
    ['just after half the length, so it cuts there', `${'a'.repeat(51)} ${'b'.repeat(60)}`, `${'a'.repeat(51)}…`],
  ])('uses the last word break only after half the length: a break %s', (_case, text, expected) => {
    // Act
    const title = postTitle(text);

    // Assert
    expect(title).toBe(expected);
  });

  test('keeps a title of exactly 100 characters whole and cuts one of 101', () => {
    // Act / Assert
    expect(postTitle('a'.repeat(100))).toBe('a'.repeat(100));
    expect(postTitle('a'.repeat(101))).toBe(`${'a'.repeat(100)}…`);
  });

  test('collapses runs of spaces and tabs and trims the line', () => {
    // Act / Assert
    expect(postTitle('  hello \t  big   world  ')).toBe('hello big world');
  });

  test('skips lines that are empty or hold only spaces', () => {
    // Act / Assert
    expect(postTitle('\n   \n\t\nSecond line\nThird')).toBe('Second line');
  });

  test('does not split an emoji when it cuts', () => {
    // Arrange
    const long = '😀'.repeat(120);

    // Act
    const title = postTitle(long);

    // Assert
    expect(title).toBe(`${'😀'.repeat(100)}…`);
  });

  test('falls back when the post has no text', () => {
    // Act / Assert
    expect(postTitle('<p><img src="x.png"></p>')).toBe('Post');
  });
});
