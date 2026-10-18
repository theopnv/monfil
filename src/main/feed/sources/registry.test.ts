// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { detectType, resolveSource } from './registry';

describe('resolveSource', () => {
  test.each([
    ['https://www.youtube.com/@Underscore_', 'youtube'],
    ['https://github.com/microsoft/playwright', 'github'],
    ['https://gitlab.com/gitlab-org/gitlab', 'gitlab'],
    ['https://news.ycombinator.com/', 'hackernews'],
    ['https://arxiv.org/list/cs.AI/recent', 'arxiv'],
    ['https://bsky.app/profile/bsky.app', 'bluesky'],
    ['@jay.bsky.team', 'bluesky'],
    ['@nova@hachyderm.io', 'mastodon'],
    ['https://developers.events/all-events.json?topics=devops', 'conference'],
    ['https://hachyderm.io/@nova', 'rss'],
    ['https://example.com/blog', 'rss'],
  ] as const)('picks the adapter for %s without a chip', (link, type) => {
    // Act / Assert
    expect(resolveSource(link).type).toBe(type);
  });

  test('the chip wins over host detection', () => {
    // Act / Assert
    expect(resolveSource('https://github.com/microsoft/playwright', 'rss').type).toBe('rss');
  });
});

describe('detectType', () => {
  test.each([
    ['https://www.youtube.com/feeds/videos.xml?channel_id=UCWedHS9qKebauVIK2J7383g', 'youtube'],
    ['https://github.com/microsoft/playwright/releases.atom', 'github'],
    ['https://github.com/torvalds.atom', 'github'],
    ['https://gitlab.com/gitlab-org/gitlab/-/releases.atom', 'gitlab'],
    ['https://news.ycombinator.com/rss', 'hackernews'],
    ['https://hnrss.org/newest?points=300', 'hackernews'],
    ['https://rss.arxiv.org/rss/cs.AI', 'arxiv'],
    ['https://bsky.app/profile/bsky.app/rss', 'bluesky'],
    ['https://developers.events/all-events.json?topics=devops&places=France', 'conference'],
    ['https://mastodon.social/@Mastodon.rss', 'rss'],
    ['https://example.com/feed.xml', 'rss'],
    ['not a url', 'rss'],
  ] as const)('stores %s as %s', (link, type) => {
    // Act / Assert
    expect(detectType(link)).toBe(type);
  });
});
