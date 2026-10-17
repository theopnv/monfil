// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { blueskyCandidates, blueskySource, isBlueskyLink } from './bluesky';

describe('blueskyCandidates', () => {
  test('a profile URL maps to its feed', () => {
    // Act / Assert
    expect(blueskyCandidates('https://bsky.app/profile/bsky.app', false)).toEqual([{ link: 'https://bsky.app/profile/bsky.app/rss' }]);
    expect(blueskyCandidates('https://bsky.app/profile/jay.bsky.team/post/3abc', false)?.[0]?.link).toBe('https://bsky.app/profile/jay.bsky.team/rss');
  });

  test('a handle with @ or a bsky.social handle resolves without the chip', () => {
    // Act / Assert
    expect(blueskyCandidates('@jay.bsky.team', false)?.[0]?.link).toBe('https://bsky.app/profile/jay.bsky.team/rss');
    expect(blueskyCandidates('name.bsky.social', false)?.[0]?.link).toBe('https://bsky.app/profile/name.bsky.social/rss');
  });

  test('a custom-domain handle without @ needs the chip', () => {
    // Act / Assert
    expect(blueskyCandidates('example.com', true)?.[0]?.link).toBe('https://bsky.app/profile/example.com/rss');
    expect(blueskyCandidates('example.com', false)).toBeNull();
  });

  test('a Mastodon handle is not a Bluesky handle', () => {
    // Act / Assert
    expect(blueskyCandidates('@user@hachyderm.io', false)).toBeNull();
  });
});

describe('isBlueskyLink', () => {
  test('detects profile URLs and handles', () => {
    // Act / Assert
    expect(isBlueskyLink('https://bsky.app/profile/bsky.app')).toBe(true);
    expect(isBlueskyLink('@jay.bsky.team')).toBe(true);
    expect(isBlueskyLink('https://example.com/')).toBe(false);
  });
});

describe('blueskySource.parse', () => {
  test('gives title-less posts a title from their text', () => {
    // Arrange
    const feed = '<rss version="2.0"><channel><title>@bsky.app - Bluesky</title><item><link>https://bsky.app/profile/bsky.app/post/1</link><description>v1.135 is live!&#xA;&#xA;More text.</description><pubDate>16 Oct 2026 20:09 +0000</pubDate><guid isPermaLink="false">at://x/1</guid></item></channel></rss>';

    // Act
    const parsed = blueskySource.parse(feed);

    // Assert
    expect(parsed?.items[0]?.title).toBe('v1.135 is live!');
  });
});
