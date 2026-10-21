// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { feedVisibility, folderVisibility, toggleFocus, toggleFolderFocus, toggleFolderHidden, toggleHidden, visibleFeedIds } from './feed-visibility';
import { HOME_WORKSPACE_ID, type FeedSummary } from '../../../shared/contracts';

function createFeed(overrides: Partial<FeedSummary> = {}): FeedSummary {
  return {
    id: 1,
    link: 'https://example.com/feed',
    title: 'Feed',
    type: 'rss',
    showInWorkspace: 1,
    workspaceId: HOME_WORKSPACE_ID,
    last_fetched_at: undefined,
    last_error: undefined,
    icon: undefined,
    category: { id: 1, name: 'Tech', workspace_id: HOME_WORKSPACE_ID },
    itemCount: 0,
    unreadCount: 0,
    otherWorkspaceCount: 0,
    ...overrides,
  };
}

describe('feedVisibility', () => {
  test('a feed with showInWorkspace unset and not in showOnlyLinks is home', () => {
    // Arrange
    const feed = createFeed();

    // Act & Assert
    expect(feedVisibility(feed, new Set())).toBe('home');
  });

  test('a feed whose link is in showOnlyLinks is only', () => {
    // Arrange
    const feed = createFeed({ link: 'https://a.example/feed' });

    // Act & Assert
    expect(feedVisibility(feed, new Set(['https://a.example/feed']))).toBe('only');
  });

  test('a feed with showInWorkspace = 0 is hidden', () => {
    // Arrange
    const feed = createFeed({ showInWorkspace: 0 });

    // Act & Assert
    expect(feedVisibility(feed, new Set())).toBe('hidden');
  });

  test('hidden wins over only when both stores disagree', () => {
    // Arrange
    const feed = createFeed({ link: 'https://a.example/feed', showInWorkspace: 0 });

    // Act & Assert
    expect(feedVisibility(feed, new Set(['https://a.example/feed']))).toBe('hidden');
  });
});

describe('toggleFocus', () => {
  test('a home feed is focused', () => {
    expect(toggleFocus('home')).toBe('only');
  });

  test('a focused feed returns to home', () => {
    expect(toggleFocus('only')).toBe('home');
  });

  test('a hidden feed is focused', () => {
    expect(toggleFocus('hidden')).toBe('only');
  });

  test('a mixed folder is focused', () => {
    expect(toggleFocus('mixed')).toBe('only');
  });
});

describe('toggleHidden', () => {
  test('a home feed is hidden', () => {
    expect(toggleHidden('home')).toBe('hidden');
  });

  test('a focused feed is hidden', () => {
    expect(toggleHidden('only')).toBe('hidden');
  });

  test('a hidden feed returns to home', () => {
    expect(toggleHidden('hidden')).toBe('home');
  });

  test('a mixed folder is hidden', () => {
    expect(toggleHidden('mixed')).toBe('hidden');
  });
});

describe('folder toggles', () => {
  const feeds = [createFeed(), createFeed({ id: 2, link: 'https://b.example/feed' })];
  const links = (...values: string[]) => new Set(values);

  test('focus sets every feed when none is focused', () => {
    expect(toggleFolderFocus(feeds, links())).toBe('only');
  });

  test('focus sets every feed when only some are focused', () => {
    expect(toggleFolderFocus(feeds, links('https://example.com/feed'))).toBe('only');
  });

  test('focus clears when every feed is focused', () => {
    expect(toggleFolderFocus(feeds, links('https://example.com/feed', 'https://b.example/feed'))).toBe('home');
  });

  test('hide sets every feed when only some are hidden', () => {
    const partlyHidden = [createFeed({ showInWorkspace: 0 }), createFeed({ id: 2, link: 'https://b.example/feed' })];
    expect(toggleFolderHidden(partlyHidden, links())).toBe('hidden');
  });

  test('hide clears when every feed is hidden', () => {
    const allHidden = feeds.map((feed) => ({ ...feed, showInWorkspace: 0 }));
    expect(toggleFolderHidden(allHidden, links())).toBe('home');
  });
});

describe('folderVisibility', () => {
  test('an empty folder is home', () => {
    expect(folderVisibility([], new Set())).toBe('home');
  });

  test('a folder whose feeds share a state returns that state', () => {
    // Arrange
    const feeds = [createFeed({ showInWorkspace: 0 }), createFeed({ id: 2, link: 'https://b.example/feed', showInWorkspace: 0 })];

    // Act & Assert
    expect(folderVisibility(feeds, new Set())).toBe('hidden');
  });

  test('a folder whose feeds disagree is mixed', () => {
    // Arrange
    const feeds = [createFeed({ showInWorkspace: 1 }), createFeed({ id: 2, link: 'https://b.example/feed', showInWorkspace: 0 })];

    // Act & Assert
    expect(folderVisibility(feeds, new Set())).toBe('mixed');
  });
});

describe('visibleFeedIds', () => {
  test('an empty feed list yields an empty set', () => {
    expect(visibleFeedIds([], new Set())).toEqual(new Set());
  });

  test('with no only feeds, every non-hidden feed is visible', () => {
    // Arrange
    const feeds = [
      createFeed({ id: 1, link: 'https://a.example/feed' }),
      createFeed({ id: 2, link: 'https://b.example/feed', showInWorkspace: 0 }),
    ];

    // Act & Assert
    expect(visibleFeedIds(feeds, new Set())).toEqual(new Set([1]));
  });

  test('with an only feed, just the only feeds are visible', () => {
    // Arrange
    const feeds = [
      createFeed({ id: 1, link: 'https://a.example/feed' }),
      createFeed({ id: 2, link: 'https://b.example/feed' }),
    ];

    // Act & Assert
    expect(visibleFeedIds(feeds, new Set(['https://a.example/feed']))).toEqual(new Set([1]));
  });

  test('an only feed that is also hidden contributes nothing', () => {
    // Arrange
    const feeds = [createFeed({ id: 1, link: 'https://a.example/feed', showInWorkspace: 0 })];

    // Act & Assert
    expect(visibleFeedIds(feeds, new Set(['https://a.example/feed']))).toEqual(new Set());
  });
});
