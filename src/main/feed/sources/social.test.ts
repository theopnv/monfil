// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { postTitle } from './social';

describe('postTitle', () => {
  test('takes the first line of plain text', () => {
    // Act / Assert
    expect(postTitle('v1.135 is live!\n\nYou can now browse quote posts.')).toBe('v1.135 is live!');
  });

  test('strips HTML and treats paragraph breaks as lines', () => {
    // Act / Assert
    expect(postTitle('<p>New <a href="https://x.test/tags/a">#<span>Plushtodon</span></a> colours!</p><p>Second</p>')).toBe('New #Plushtodon colours!');
  });

  test('cuts a long first line on a word break and adds an ellipsis', () => {
    // Arrange
    const long = `${'word '.repeat(40)}end`;

    // Act
    const title = postTitle(long);

    // Assert
    expect(title.length).toBeLessThanOrEqual(101);
    expect(title.endsWith('word…')).toBe(true);
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

  test('leaves no tag behind when tags are nested to survive one pass', () => {
    // Act / Assert
    expect(postTitle('<scr<script>ipt>alert(1)</scr</script>ipt> hello')).not.toMatch(/<\/?scr/i);
  });
});
