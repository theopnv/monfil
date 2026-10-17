// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { hackernewsCandidates, hackernewsSource, isHackernewsLink } from './hackernews';
import { fetchText } from '../../lib/fetch';

vi.mock(import('../../lib/fetch'), () => ({
  fetchConditional: vi.fn(),
  fetchText: vi.fn(),
}));

const mockedFetchText = vi.mocked(fetchText);

const FEED = (title: string) => `<rss version="2.0"><channel><title>${title}</title><item><title>Story</title><link>https://example.com/story</link><pubDate>Mon, 01 Jan 2024 00:00:00 GMT</pubDate></item></channel></rss>`;

describe('hackernewsCandidates', () => {
  test('the site offers the official front page first, then the hnrss presets', () => {
    // Act
    const candidates = hackernewsCandidates('https://news.ycombinator.com/');

    // Assert
    expect(candidates).toEqual([
      { link: 'https://news.ycombinator.com/rss', label: 'Front page' },
      { link: 'https://hnrss.org/newest?points=100', label: '100+ points' },
      { link: 'https://hnrss.org/newest?points=300', label: '300+ points' },
      { link: 'https://hnrss.org/show', label: 'Show HN' },
      { link: 'https://hnrss.org/ask', label: 'Ask HN' },
    ]);
  });

  test('a section page maps to its hnrss feed', () => {
    // Act / Assert
    expect(hackernewsCandidates('news.ycombinator.com/show')).toEqual([{ link: 'https://hnrss.org/show', label: 'Show HN' }]);
    expect(hackernewsCandidates('https://news.ycombinator.com/newest')).toEqual([{ link: 'https://hnrss.org/newest', label: 'Newest' }]);
  });

  test('a feed URL is kept as it is', () => {
    // Act / Assert
    expect(hackernewsCandidates('https://news.ycombinator.com/rss')).toEqual([{ link: 'https://news.ycombinator.com/rss' }]);
    expect(hackernewsCandidates('https://hnrss.org/frontpage?points=50')).toEqual([{ link: 'https://hnrss.org/frontpage?points=50' }]);
  });

  test('other hosts are rejected', () => {
    // Act / Assert
    expect(hackernewsCandidates('https://lobste.rs/')).toBeNull();
  });
});

describe('isHackernewsLink', () => {
  test('detects both the site and hnrss', () => {
    // Act / Assert
    expect(isHackernewsLink('https://news.ycombinator.com/')).toBe(true);
    expect(isHackernewsLink('https://hnrss.org/newest')).toBe(true);
    expect(isHackernewsLink('https://example.com/')).toBe(false);
  });
});

describe('hackernewsSource.discover', () => {
  afterEach(() => {
    mockedFetchText.mockReset();
  });

  test('fetches every preset, keeps their order and drops the ones that fail', async () => {
    // Arrange
    mockedFetchText.mockImplementation((url) => Promise.resolve(url.includes('points=300')
      ? { success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } }
      : { success: true, data: { body: FEED(url), validators: { etag: undefined, last_modified: undefined } } }));

    // Act
    const result = await hackernewsSource.discover('https://news.ycombinator.com/');

    // Assert
    expect(result.success).toBe(true);
    const candidates = result.success ? result.data : [];
    expect(candidates.map((candidate) => candidate.label)).toEqual(['Front page', '100+ points', 'Show HN', 'Ask HN']);
    expect(candidates.every((candidate) => candidate.type === 'hackernews')).toBe(true);
    expect(candidates[0]?.link).toBe('https://news.ycombinator.com/rss');
  });

  test('returns the first error when every candidate fails', async () => {
    // Arrange
    mockedFetchText.mockResolvedValue({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });

    // Act
    const result = await hackernewsSource.discover('https://news.ycombinator.com/');

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NETWORK_ERROR', message: 'offline' } });
  });

  test('rejects a link that is not Hacker News with a platform message', async () => {
    // Act
    const result = await hackernewsSource.discover('https://example.com/');

    // Assert
    expect(result.success).toBe(false);
    expect(result.success ? undefined : result.error.name).toBe('UNSUPPORTED_FORMAT');
    expect(mockedFetchText).not.toHaveBeenCalled();
  });
});
