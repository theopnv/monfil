// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import type { DOMWindow } from 'jsdom';
import { extractArticle } from './extractArticle';

// The utility process lives as long as the app, so a window left open leaks its document and timers.
const created = vi.hoisted(() => [] as DOMWindow[]);

vi.mock(import('jsdom'), async (importOriginal) => {
  const actual = await importOriginal();
  class TrackedJSDOM extends actual.JSDOM {
    constructor(...args: ConstructorParameters<typeof actual.JSDOM>) {
      super(...args);
      vi.spyOn(this.window, 'close');
      created.push(this.window);
    }
  }
  return { ...actual, JSDOM: TrackedJSDOM };
});

const PARAGRAPH = 'This is a long paragraph about something interesting that readers care about deeply. '.repeat(6);

afterEach(() => {
  created.length = 0;
});

describe('extractArticle windows', () => {
  test('closes every window it opens after extracting an article', () => {
    // Act
    const article = extractArticle(`<html><body><article><h1>Title</h1><p>${PARAGRAPH}</p><p>${PARAGRAPH}</p></article></body></html>`, 'https://example.com/story');

    // Assert
    expect(article).toBeDefined();
    expect(created.length).toBeGreaterThan(0);
    expect(created.map((window) => vi.mocked(window.close).mock.calls.length)).toEqual(created.map(() => 1));
  });

  test('closes the window when the page holds no article', () => {
    // Act
    const article = extractArticle('<html><body></body></html>', 'https://example.com/empty');

    // Assert
    expect(article).toBeUndefined();
    expect(created.length).toBeGreaterThan(0);
    expect(created.map((window) => vi.mocked(window.close).mock.calls.length)).toEqual(created.map(() => 1));
  });

  test('parses the page and its article only', () => {
    // Act
    extractArticle(`<html><body><article><h1>Title</h1><p>${PARAGRAPH}</p><p>${PARAGRAPH}</p></article></body></html>`, 'https://example.com/story');

    // Assert
    expect(created).toHaveLength(2);
  });
});
