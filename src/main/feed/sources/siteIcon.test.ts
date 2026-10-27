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

  const png256 = '<link rel="icon" href="/p256.png" sizes="256x256">';

  test.each([
    ['sizes="any", in any letter case', '<link rel="icon" href="/scalable.ico" sizes="ANY">', 'https://site.example/scalable.ico'],
    ['an svg file with no sizes', '<link rel="icon" href="/logo.svg">', 'https://site.example/logo.svg'],
    ['an svg file with a query', '<link rel="icon" href="/logo.svg?v=2">', 'https://site.example/logo.svg?v=2'],
    ['an svg file with a fragment', '<link rel="icon" href="/logo.svg#mark">', 'https://site.example/logo.svg#mark'],
  ])('an icon with %s comes before a 256 pixel png', (_name, scalable, expected) => {
    // Act
    const links = extractIconLinks(`${png256}${scalable}`, 'https://site.example/');

    // Assert
    expect(links).toEqual([expected, 'https://site.example/p256.png']);
  });

  test.each([
    ['an svg file with declared sizes', '<link rel="icon" href="/logo.svg" sizes="16x16">'],
    ['a file name that only starts with .svg', '<link rel="icon" href="/logo.svgx">'],
    ['a name that has .svg in the middle', '<link rel="icon" href="/logo.svg.png">'],
  ])('%s is not taken as scalable', (_name, other) => {
    // Act
    const links = extractIconLinks(`${other}${png256}`, 'https://site.example/');

    // Assert
    expect(links[0]).toBe('https://site.example/p256.png');
  });

  test('an icon with several sizes counts with the largest', () => {
    // Arrange
    const html = '<link rel="icon" href="/mid.png" sizes="48x48"><link rel="icon" href="/multi.png" sizes="16x16 64x64">';

    // Act
    const links = extractIconLinks(html, 'https://site.example/');

    // Assert
    expect(links).toEqual(['https://site.example/multi.png', 'https://site.example/mid.png']);
  });

  test('an apple touch icon with no sizes comes before an icon with no sizes, and the precomposed one counts', () => {
    // Arrange
    const html = '<link rel="icon" href="/plain.png"><link rel="apple-touch-icon-precomposed" href="/touch.png">';

    // Act
    const links = extractIconLinks(html, 'https://site.example/');

    // Assert
    expect(links).toEqual(['https://site.example/touch.png', 'https://site.example/plain.png']);
  });

  test('a dark-scheme icon comes after an icon with no sizes', () => {
    // Arrange
    const html = '<link rel="icon" href="/dark.png" media="(prefers-color-scheme: dark)"><link rel="icon" href="/plain.png">';

    // Act
    const links = extractIconLinks(html, 'https://site.example/');

    // Assert
    expect(links).toEqual(['https://site.example/plain.png', 'https://site.example/dark.png']);
  });

  test('reads single-quoted and unquoted attributes, and resolves relative and protocol-relative links', () => {
    // Arrange
    const html = '<link rel=\'icon\' href=\'img/a.png\' sizes=\'64x64\'><link rel=icon href=//cdn.example/b.png sizes=32x32>';

    // Act
    const links = extractIconLinks(html, 'https://site.example/blog/post');

    // Assert
    expect(links).toEqual(['https://site.example/blog/img/a.png', 'https://cdn.example/b.png']);
  });

  test('keeps an http icon', () => {
    // Act
    const links = extractIconLinks('<link rel="icon" href="http://plain.example/i.png">', 'https://site.example/');

    // Assert
    expect(links).toEqual(['http://plain.example/i.png']);
  });

  test('a page with no link tag has no icon', () => {
    // Act / Assert
    expect(extractIconLinks('<p>nothing</p>', 'https://site.example/')).toEqual([]);
  });

  test('drops links that are not web or data images', () => {
    // Arrange
    const html = '<link rel="icon" href="javascript:alert(1)"><link rel="icon" href="data:image/png;base64,AAAA">';

    // Act
    const links = extractIconLinks(html, 'https://site.example/');

    // Assert
    expect(links).toEqual(['data:image/png;base64,AAAA']);
  });

  test.each([
    'data:text/html;base64,AAAA',
    'javascript:image/png',
    'ftp://files.example/icon.png',
  ])('drops the icon link %s', (href) => {
    // Act
    const links = extractIconLinks(`<link rel="icon" href="${href}">`, 'https://site.example/');

    // Assert
    expect(links).toEqual([]);
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

  test('reads the page of a site that uses http', async () => {
    // Arrange
    serve({ 'http://old.example/': ok('<link rel="icon" href="/i.png">') });

    // Act
    const icon = await resolveSiteIcon('http://old.example/');

    // Assert
    expect(icon).toBe('http://old.example/i.png');
  });

  test.each(['ftp://site.example/', 'javascript:alert(1)', 'not a url'])('makes no request for the site link %s', async (siteLink) => {
    // Arrange
    serve({});

    // Act
    const icon = await resolveSiteIcon(siteLink);

    // Assert
    expect(icon).toBeUndefined();
    expect(mockedFetchText).not.toHaveBeenCalled();
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
