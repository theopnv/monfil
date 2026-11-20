// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { riverView } from './RiverBody';

const home = {
  savedView: false, isPending: false, isError: false, isFeedpackRefreshing: false, awaitingFeeds: false,
  hasFeeds: true, hasSearch: false, hasItems: true, unreadCount: 3,
};
const saved = { ...home, savedView: true };

describe('riverView', () => {
  test.each([
    ['the list when feeds have unread items', home, 'list'],
    ['the caught-up note when nothing is unread', { ...home, unreadCount: 0 }, 'caught-up'],
    ['the empty river when the workspace has no feed', { ...home, hasFeeds: false }, 'empty-river'],
    ['nothing while the feeds load', { ...home, awaitingFeeds: true }, 'waiting'],
    ['the feedpack note while a pack installs', { ...home, isFeedpackRefreshing: true }, 'feedpack-fetching'],
    ['the feedpack note before the empty river', { ...home, isFeedpackRefreshing: true, hasFeeds: false }, 'feedpack-fetching'],
    ['the list for a search with matches', { ...home, hasSearch: true, unreadCount: 0 }, 'list'],
    ['the no-results note for a search without matches', { ...home, hasSearch: true, hasItems: false }, 'no-results'],
    ['the loading note of Saved', { ...saved, isPending: true }, 'saved-loading'],
    ['the failure of Saved before its list', { ...saved, isError: true }, 'saved-failed'],
    ['the empty note of Saved', { ...saved, hasItems: false }, 'saved-empty'],
    ['the list of Saved with no unread item', { ...saved, unreadCount: 0 }, 'list'],
    ['the list of Saved for a search with matches', { ...saved, hasSearch: true }, 'list'],
    ['the no-results note of Saved for a search without matches', { ...saved, hasSearch: true, hasItems: false }, 'no-results'],
    ['the list of Saved without feeds', { ...saved, hasFeeds: false }, 'list'],
  ] as const)('shows %s', (_name, state, expected) => {
    // Act & Assert
    expect(riverView(state)).toBe(expected);
  });

  test('ignores the feedpack install on Saved', () => {
    // Act & Assert
    expect(riverView({ ...saved, isFeedpackRefreshing: true })).toBe('list');
  });
});
