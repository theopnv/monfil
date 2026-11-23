// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import type SQLite from 'better-sqlite3';
import { registerSearchFunctions } from './search';

function hasWord(): (text: unknown, word: unknown) => number {
  const register = vi.fn();
  registerSearchFunctions({ function: register } as unknown as SQLite.Database);
  const [name, options, implementation] = register.mock.calls[0] ?? [];
  expect(name).toBe('has_word');
  expect(options).toEqual({ deterministic: true });
  return implementation;
}

describe('has_word', () => {
  test('matches a whole word in any letter case', () => {
    // Arrange
    const matches = hasWord();

    // Act / Assert
    expect(matches('Faster CI for everyone', 'ci')).toBe(1);
  });

  test('reads a regular expression character in the word as plain text', () => {
    // Arrange
    const matches = hasWord();

    // Act / Assert
    expect(matches('C++ and c#', 'c++')).toBe(1);
    expect(matches('abc', 'a.c')).toBe(0);
  });

  test.each([ ['text', undefined]])('answers 0 for the non-text arguments %j and %j', (text, word) => {
    // Arrange
    const matches = hasWord();

    // Act / Assert
    expect(matches(text, word)).toBe(0);
  });

  test('keeps answering right after it has seen more distinct words than it remembers', () => {
    // Arrange
    const matches = hasWord();
    for (let index = 0; index < 2_000; index += 1) {
      matches('some text', `w${index}`);
    }

    // Act / Assert
    expect(matches('a w0 b', 'w0')).toBe(1);
    expect(matches('a w1999 b', 'w1999')).toBe(1);
    expect(matches('a w1999 b', 'w0')).toBe(0);
  });
});
