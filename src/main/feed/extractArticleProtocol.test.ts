// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import {
  isExtractArticleLog,
  isExtractArticleRequest,
  isExtractArticleResponse,
} from './extractArticleProtocol';

const notObjects = [null, undefined, 0, 1, '', 'text', true, false];

describe('isExtractArticleRequest', () => {
  const valid = { id: 1, html: '<p>x</p>', url: 'https://example.com/a' };

  test('accepts a complete request', () => {
    // Act & Assert
    expect(isExtractArticleRequest(valid)).toBe(true);
  });

  test('accepts empty strings and a zero id', () => {
    // Act & Assert
    expect(isExtractArticleRequest({ id: 0, html: '', url: '' })).toBe(true);
  });

  test.each(notObjects)('rejects %s', (value) => {
    // Act & Assert
    expect(isExtractArticleRequest(value)).toBe(false);
  });

  test.each(['id', 'html', 'url'] as const)('rejects a request without %s', (field) => {
    // Arrange
    const rest = Object.fromEntries(Object.entries(valid).filter(([key]) => key !== field));

    // Act & Assert
    expect(isExtractArticleRequest(rest)).toBe(false);
  });

  test.each([
    ['id', '1'],
    ['id', null],
    ['html', 5],
    ['html', null],
    ['url', 5],
    ['url', undefined],
  ])('rejects %s set to %j', (field, wrong) => {
    // Act & Assert
    expect(isExtractArticleRequest({ ...valid, [field]: wrong })).toBe(false);
  });
});

describe('isExtractArticleResponse', () => {
  const article = { html: '<p>x</p>', text: 'x', wordCount: 1 };

  test('accepts a response with an article', () => {
    // Act & Assert
    expect(isExtractArticleResponse({ id: 1, article })).toBe(true);
  });

  test('accepts a response whose article is undefined', () => {
    // Act & Assert
    expect(isExtractArticleResponse({ id: 1, article: undefined })).toBe(true);
  });

  test('accepts a response without an article key', () => {
    // Act & Assert
    expect(isExtractArticleResponse({ id: 1 })).toBe(true);
  });

  test('accepts empty article strings and a zero word count', () => {
    // Act & Assert
    expect(isExtractArticleResponse({ id: 0, article: { html: '', text: '', wordCount: 0 } })).toBe(true);
  });

  test.each(notObjects)('rejects %s', (value) => {
    // Act & Assert
    expect(isExtractArticleResponse(value)).toBe(false);
  });

  test.each([
    ['without id', { article }],
    ['with a string id', { id: '1', article }],
    ['with a null id', { id: null, article }],
    ['with an article without html', { id: 1, article: { text: 'x', wordCount: 1 } }],
    ['with an article without text', { id: 1, article: { html: 'x', wordCount: 1 } }],
    ['with an article without wordCount', { id: 1, article: { html: 'x', text: 'x' } }],
    ['with a numeric html', { id: 1, article: { html: 1, text: 'x', wordCount: 1 } }],
    ['with a numeric text', { id: 1, article: { html: 'x', text: 1, wordCount: 1 } }],
    ['with a string wordCount', { id: 1, article: { html: 'x', text: 'x', wordCount: '1' } }],
    ['with a primitive article', { id: 1, article: 5 }],
  ])('rejects a response %s', (_name, value) => {
    // Act & Assert
    expect(isExtractArticleResponse(value)).toBe(false);
  });
});

describe('isExtractArticleLog', () => {
  test('accepts a log message', () => {
    // Act & Assert
    expect(isExtractArticleLog({ type: 'log', message: 'hello' })).toBe(true);
  });

  test('accepts an empty message', () => {
    // Act & Assert
    expect(isExtractArticleLog({ type: 'log', message: '' })).toBe(true);
  });

  test.each(notObjects)('rejects %s', (value) => {
    // Act & Assert
    expect(isExtractArticleLog(value)).toBe(false);
  });

  test.each([
    ['without type', { message: 'hello' }],
    ['without message', { type: 'log' }],
    ['with another type', { type: 'warn', message: 'hello' }],
    ['with a numeric message', { type: 'log', message: 1 }],
    ['with a null message', { type: 'log', message: null }],
  ])('rejects a log %s', (_name, value) => {
    // Act & Assert
    expect(isExtractArticleLog(value)).toBe(false);
  });
});
