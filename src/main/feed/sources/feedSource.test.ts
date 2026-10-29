// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { fetchConditional, fetchText, type FetchTextResult } from '../../lib/fetch';
import { createFeedSource, fetchAndParse, fetchCandidates, MAX_CANDIDATES, toUrl, withScheme } from './feedSource';
import type { ParsedFeedContent } from './types';

vi.mock(import('../../lib/fetch'), () => ({
  fetchConditional: vi.fn(),
  fetchText: vi.fn(),
}));

const mockedFetchText = vi.mocked(fetchText);
const mockedFetchConditional = vi.mocked(fetchConditional);

const ok = (body: string): FetchTextResult => ({ success: true, data: { body, validators: { etag: undefined, last_modified: undefined } } });
const parsedFeed: ParsedFeedContent = { title: 'Feed', description: '', items: [] };
const parseAlways = () => parsedFeed;

afterEach(() => {
  mockedFetchText.mockReset();
  mockedFetchConditional.mockReset();
});

describe('withScheme', () => {
  test('keeps a link that starts with http or https, in any letter case', () => {
    // Act / Assert
    expect(withScheme('http://example.com/a')).toBe('http://example.com/a');
    expect(withScheme('HTTPS://example.com/a')).toBe('HTTPS://example.com/a');
  });

  test('adds https to a link with no scheme, even when a scheme appears later in it', () => {
    // Act / Assert
    expect(withScheme('example.com/a')).toBe('https://example.com/a');
    expect(withScheme('example.com/?next=https://other.example/')).toBe('https://example.com/?next=https://other.example/');
  });
});

describe('toUrl', () => {
  test('ignores the spaces around the link', () => {
    // Act
    const url = toUrl('  https://example.com/a  ');

    // Assert
    expect(url?.href).toBe('https://example.com/a');
  });

  test('gives null for text that is not a link', () => {
    // Act / Assert
    expect(toUrl('not a link')).toBeNull();
  });
});

describe('fetchAndParse', () => {
  test('refuses a body that the parser does not accept', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue(ok('<html></html>'));

    // Act
    const result = await fetchAndParse('https://example.com/feed', undefined, () => null);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a supported feed." } });
  });

  test('turns an error thrown by the parser into a parse error', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue(ok('not a feed'));

    // Act
    const result = await fetchAndParse('https://example.com/feed', undefined, () => {
      throw new Error('bad feed');
    });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'PARSE_ERROR', message: 'bad feed' } });
  });

  test('names the web page when the parser throws on an html body', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue(ok('<html></html>'));

    // Act
    const result = await fetchAndParse('https://example.com/feed', undefined, () => {
      throw new Error('bad feed');
    });

    // Assert
    expect(result).toEqual({
      success: false,
      error: { name: 'PARSE_ERROR', message: 'The site sent a web page instead of the feed. It may show a bot check to automated readers or to your network or VPN.' },
    });
  });

  test('turns a thrown value that is not an error into an unknown error', async () => {
    // Arrange
    mockedFetchText.mockRejectedValue('boom');

    // Act
    const result = await fetchAndParse('https://example.com/feed', undefined, parseAlways);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNKNOWN_ERROR', message: 'An unknown error occurred' } });
  });
});

describe('createFeedSource fetch', () => {
  const atomFeed = '<?xml version="1.0"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Releases</title><subtitle>All releases</subtitle><link rel="alternate" href="https://site.example/"/><id>feed</id></feed>';
  const source = createFeedSource({ type: 'github', fetchesFullArticle: false, toCandidates: () => null, mismatchMessage: 'Not for this source.' });

  test('reads a stored link with no scheme as https and returns the feed with the validators of the response', async () => {
    // Arrange
    const validators = { etag: '"v1"', last_modified: undefined };
    mockedFetchText.mockResolvedValue({ success: true, data: { body: atomFeed, validators } });

    // Act
    const result = await source.fetch({ link: 'site.example/releases.atom' });

    // Assert
    expect(mockedFetchText).toHaveBeenCalledWith('https://site.example/releases.atom');
    expect(result).toEqual({
      success: true,
      data: {
        validators,
        parsed: { type: 'github', link: 'https://site.example/releases.atom', title: 'Releases', description: 'All releases', items: [], icon: undefined, siteLink: 'https://site.example/' },
      },
    });
  });

  test('passes on a failed download', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    const result = await source.fetch({ link: 'https://site.example/releases.atom' });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });
  });

  test('passes on a 304 answer to a conditional request', async () => {
    // Arrange
    const validators = { etag: '"v1"', last_modified: undefined };
    mockedFetchConditional.mockResolvedValue({ success: true, data: { notModified: true } });

    // Act
    const result = await source.fetch({ link: 'https://site.example/releases.atom', validators });

    // Assert
    expect(mockedFetchConditional).toHaveBeenCalledWith('https://site.example/releases.atom', { validators });
    expect(result).toEqual({ success: true, data: { notModified: true } });
  });
});

describe('createFeedSource discover', () => {
  test('refuses text that the source cannot read, with its own message and without a request', async () => {
    // Arrange
    const source = createFeedSource({ type: 'github', fetchesFullArticle: false, toCandidates: () => null, mismatchMessage: 'Not for this source.' });

    // Act
    const result = await source.discover('anything');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: 'Not for this source.' } });
    expect(mockedFetchText).not.toHaveBeenCalled();
  });
});

describe('fetchCandidates', () => {
  test('fetches no more than the maximum number of candidates', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue(ok('<feed/>'));
    const candidates = Array.from({ length: MAX_CANDIDATES + 2 }, (_, index) => ({ link: `https://example.com/feed${index}`, icon: 'https://example.com/icon.png' }));

    // Act
    const result = await fetchCandidates('rss', candidates, parseAlways);

    // Assert
    expect(result.success && result.data.map((source) => source.link)).toEqual(candidates.slice(0, MAX_CANDIDATES).map((candidate) => candidate.link));
    expect(mockedFetchText).toHaveBeenCalledTimes(MAX_CANDIDATES);
  });

  test('refuses an empty list of candidates', async () => {
    // Act
    const result = await fetchCandidates('rss', [], parseAlways);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'UNSUPPORTED_FORMAT', message: "This doesn't look like a supported feed." } });
  });
});
