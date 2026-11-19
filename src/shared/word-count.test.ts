// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { countWords } from './word-count';

describe('countWords', () => {
  test.each([
    { name: 'an empty text', text: '', expected: 0 },
    { name: 'only whitespace', text: ' \n\t ', expected: 0 },
    { name: 'one word', text: 'hello', expected: 1 },
    { name: 'words split by spaces and newlines', text: '  one two\nthree\t four  ', expected: 4 },
    { name: 'accented words', text: 'élève à Paris', expected: 3 },
    { name: 'Arabic words', text: 'مرحبا بالعالم اليوم', expected: 3 },
  ])('counts $name', ({ text, expected }) => {
    // Act
    const count = countWords(text);

    // Assert
    expect(count).toBe(expected);
  });

  test.each([
    { name: 'Chinese', text: '今天天气很好我们去公园散步', expected: 7 },
    { name: 'Japanese with kana', text: '今日はいい天気ですね', expected: 5 },
    { name: 'Katakana', text: 'コンピュータ', expected: 3 },
    { name: 'one Chinese character', text: '好', expected: 1 },
    { name: 'Chinese with its punctuation', text: '你好，世界！', expected: 2 },
    { name: 'Japanese with its brackets and full stop', text: '「今日は」。', expected: 2 },
  ])('counts two characters of $name as one word', ({ text, expected }) => {
    // Act
    const count = countWords(text);

    // Assert
    expect(count).toBe(expected);
  });

  test('adds the spaced words of a mixed text to the characters', () => {
    // Act
    const count = countWords('Monfil 是一个 RSS 阅读器');

    // Assert
    expect(count).toBe(2 + 3);
  });

  test('keeps a spaced word apart from the Chinese characters and the full-width punctuation around it', () => {
    // Act
    const characters = countWords('Monfil是RSS');
    const punctuation = countWords('Hello，world');

    // Assert
    expect(characters).toBe(2 + 1);
    expect(punctuation).toBe(2);
  });

  test('counts a spaced word that touches Chinese characters on its own', () => {
    // Act
    const count = countWords('AI技术');

    // Assert
    expect(count).toBe(1 + 1);
  });
});
