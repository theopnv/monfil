// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { isMastodonHandle, mastodonCandidates, mastodonSource } from './mastodon';

describe('mastodonCandidates', () => {
  test('a full handle maps to the profile feed on its instance', () => {
    // Act / Assert
    expect(mastodonCandidates('@Mastodon@mastodon.social', false)).toEqual([{ link: 'https://mastodon.social/@Mastodon.rss' }]);
  });

  test('a profile or tag URL on any host maps to its feed only with the chip', () => {
    // Act / Assert
    expect(mastodonCandidates('https://hachyderm.io/@nova', true)?.[0]?.link).toBe('https://hachyderm.io/@nova.rss');
    expect(mastodonCandidates('https://hachyderm.io/tags/rust', true)?.[0]?.link).toBe('https://hachyderm.io/tags/rust.rss');
    expect(mastodonCandidates('https://hachyderm.io/@nova', false)).toBeNull();
  });

  test('a handle without the leading @ resolves with the chip', () => {
    // Act / Assert
    expect(mastodonCandidates('nova@hachyderm.io', true)?.[0]?.link).toBe('https://hachyderm.io/@nova.rss');
  });

  test('a stored feed URL is kept as it is', () => {
    // Act / Assert
    expect(mastodonCandidates('https://hachyderm.io/@nova.rss', true)?.[0]?.link).toBe('https://hachyderm.io/@nova.rss');
  });

  test('a page that is not a profile or tag is rejected', () => {
    // Act / Assert
    expect(mastodonCandidates('https://hachyderm.io/about', true)).toBeNull();
  });
});

describe('isMastodonHandle', () => {
  test('detects only the @user@host form', () => {
    // Act / Assert
    expect(isMastodonHandle('@nova@hachyderm.io')).toBe(true);
    expect(isMastodonHandle('@jay.bsky.team')).toBe(false);
    expect(isMastodonHandle('https://hachyderm.io/@nova')).toBe(false);
  });
});

describe('mastodonSource.parse', () => {
  test('gives title-less posts a title from their HTML text', () => {
    // Arrange
    const feed = '<rss version="2.0"><channel><title>Mastodon</title><item><guid>https://m.test/@a/1</guid><link>https://m.test/@a/1</link><pubDate>Fri, 09 Oct 2026 14:28:25 +0000</pubDate><description>&lt;p&gt;Hello &lt;b&gt;world&lt;/b&gt;&lt;/p&gt;</description></item></channel></rss>';

    // Act
    const parsed = mastodonSource.parse(feed);

    // Assert
    expect(parsed?.items[0]?.title).toBe('Hello world');
  });
});
