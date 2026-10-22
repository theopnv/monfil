// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchText, type FetchTextResult } from '../../lib/fetch';
import { extractIconLinks, resolveSiteIcon } from './siteIcon';

vi.mock(import('../../lib/fetch'), () => ({
  fetchText: vi.fn(),
}));

const mockedFetchText = vi.mocked(fetchText);

function ok(body: string): FetchTextResult {
  return { success: true, data: { body, validators: { etag: undefined, last_modified: undefined } } };
}

const notFound: FetchTextResult = { success: false, error: { name: 'GENERIC_FETCH_ERROR', message: '404: Not Found' } };

function serve(responses: Record<string, FetchTextResult>): void {
  mockedFetchText.mockImplementation(async (url) => responses[url] ?? notFound);
}

afterEach(() => {
  mockedFetchText.mockReset();
});

describe('extractIconLinks', () => {
  test('resolves a declared icon against the page address', () => {
    // Arrange
    const html = '<head><link rel="icon" href="/brand/symbol.svg" type="image/svg+xml"></head>';

    // Act
    const links = extractIconLinks(html, 'https://moderne.example/blog');

    // Assert
    expect(links).toEqual(['https://moderne.example/brand/symbol.svg']);
  });

  test('puts the largest icon first and the dark-scheme variant last', () => {
    // Arrange
    const html = [
      '<link rel="icon" href="/dark.svg" media="(prefers-color-scheme: dark)">',
      '<link rel="shortcut icon" href="/small.png" sizes="16x16">',
      '<link rel="apple-touch-icon" href="/touch.png">',
      '<link rel="icon" href="/big.png" sizes="192x192">',
      '<link rel="mask-icon" href="/mask.svg">',
      '<link rel="stylesheet" href="/site.css">',
    ].join('');

    // Act
    const links = extractIconLinks(html, 'https://site.example/');

    // Assert
    expect(links).toEqual(['https://site.example/big.png', 'https://site.example/touch.png', 'https://site.example/small.png', 'https://site.example/dark.svg']);
  });

  test('drops links that are not web or data images', () => {
    // Arrange
    const html = '<link rel="icon" href="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AAAA">';

    // Act
    const links = extractIconLinks(html, 'https://site.example/');

    // Assert
    expect(links).toEqual(['data:image/png;base64,AAAA']);
  });
});

describe('resolveSiteIcon', () => {
  test('returns the icon the site page declares', async () => {
    // Arrange
    serve({ 'https://mergify.example/': ok('<link rel="icon" type="image/svg+xml" href="/favicon.svg">') });

    // Act
    const icon = await resolveSiteIcon('https://mergify.example/');

    // Assert
    expect(icon).toBe('https://mergify.example/favicon.svg');
  });

  test('falls back to /favicon.ico when the page declares no icon', async () => {
    // Arrange
    serve({ 'https://site.example/blog': ok('<html></html>'), 'https://site.example/favicon.ico': ok('') });

    // Act
    const icon = await resolveSiteIcon('https://site.example/blog');

    // Assert
    expect(icon).toBe('https://site.example/favicon.ico');
  });

  test('falls back to the icon service only when it has the site', async () => {
    // Arrange
    serve({ 'https://icons.duckduckgo.com/ip3/site.example.ico': ok('') });

    // Act
    const icon = await resolveSiteIcon('https://site.example/');

    // Assert
    expect(icon).toBe('https://icons.duckduckgo.com/ip3/site.example.ico');
  });

  test('returns nothing when no source has an icon, so the placeholder is never stored', async () => {
    // Arrange
    serve({});

    // Act
    const icon = await resolveSiteIcon('https://moderne.example/blog');

    // Assert
    expect(icon).toBeUndefined();
  });

  test('refuses private hosts for every request', async () => {
    // Arrange
    serve({});

    // Act
    await resolveSiteIcon('https://site.example/');

    // Assert
    expect(mockedFetchText.mock.calls.every(([, options]) => options?.blockPrivateHosts === true)).toBe(true);
  });
});
