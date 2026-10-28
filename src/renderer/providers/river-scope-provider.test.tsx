// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { act, type PropsWithChildren } from 'react';
import { afterEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { PreferencesProvider, usePreferences } from './preferences-provider';
import { RiverScopeProvider, useActiveSearchId, useRiverScope, useRiverScopeState } from './river-scope-provider';
import { SearchProvider, useSearch } from './search-provider';
import { renderHookInWorkspace } from '../lib/test/render-hook-in-workspace';
import { HOME_WORKSPACE_ID, type FeedSummary } from '../../shared/contracts';

describe('RiverScopeProvider', () => {
  test('a focus set in one workspace does not change another workspace', async () => {
    // Arrange
    const { result, act } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });

    // Act
    await act(() => result.current.setShowOnlyLinks(2, () => new Set(['https://a.example/feed'])));

    // Assert
    expect(result.current.getShowOnlyLinks(2)).toEqual(new Set(['https://a.example/feed']));
    expect(result.current.getShowOnlyLinks(3)).toEqual(new Set());
  });

  test('updates see only the set of their own workspace', async () => {
    // Arrange
    const { result, act } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });
    await act(() => result.current.setShowOnlyLinks(2, () => new Set(['https://a.example/feed'])));
    await act(() => result.current.setShowOnlyLinks(3, () => new Set(['https://b.example/feed'])));

    // Act
    await act(() => result.current.setShowOnlyLinks(2, (prev) => new Set([...prev, 'https://c.example/feed'])));

    // Assert
    expect(result.current.getShowOnlyLinks(2)).toEqual(new Set(['https://a.example/feed', 'https://c.example/feed']));
    expect(result.current.getShowOnlyLinks(3)).toEqual(new Set(['https://b.example/feed']));
  });

  test('an unfocused workspace has a stable empty set', async () => {
    // Arrange
    const { result } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });

    // Assert
    expect(result.current.getShowOnlyLinks(9)).toBe(result.current.getShowOnlyLinks(10));
  });

  test('keeps the same sets when an update changes nothing', async () => {
    // Arrange
    const { result, act } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });
    await act(() => result.current.setShowOnlyLinks(2, () => new Set(['https://a.example/feed'])));
    const before = result.current.getShowOnlyLinks(2);

    // Act
    await act(() => result.current.setShowOnlyLinks(2, (prev) => prev));

    // Assert
    expect(result.current.getShowOnlyLinks(2)).toBe(before);
  });

  test('emptying the focus of a workspace gives back the shared empty set', async () => {
    // Arrange
    const { result, act } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });
    await act(() => result.current.setShowOnlyLinks(2, () => new Set(['https://a.example/feed'])));

    // Act
    await act(() => result.current.setShowOnlyLinks(2, () => new Set()));

    // Assert
    expect(result.current.getShowOnlyLinks(2)).toBe(result.current.getShowOnlyLinks(9));
  });

  test('an update that returns the same set leaves the focus state untouched', async () => {
    // Arrange
    const { result, act } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });
    const before = result.current.getShowOnlyLinks;

    // Act
    await act(() => result.current.setShowOnlyLinks(2, (prev) => prev));

    // Assert
    expect(result.current.getShowOnlyLinks).toBe(before);
  });

  test('selecting the saved search that is already active leaves the state untouched', async () => {
    // Arrange
    const { result, act } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });
    await act(() => result.current.setActiveSearchId(2, 7));
    const before = result.current.getActiveSearchId;

    // Act
    await act(() => result.current.setActiveSearchId(2, 7));
    await act(() => result.current.setActiveSearchId(3, undefined));

    // Assert
    expect(result.current.getActiveSearchId).toBe(before);
  });

  test('an active saved search belongs to one workspace and can be cleared', async () => {
    // Arrange
    const { result, act } = await renderHook(() => useRiverScopeState(), { wrapper: RiverScopeProvider });

    // Act
    await act(() => result.current.setActiveSearchId(2, 7));
    await act(() => result.current.setActiveSearchId(3, 8));

    // Assert
    expect(result.current.getActiveSearchId(2)).toBe(7);
    expect(result.current.getActiveSearchId(3)).toBe(8);
    expect(result.current.getActiveSearchId(4)).toBeUndefined();

    // Act
    await act(() => result.current.setActiveSearchId(2, undefined));

    // Assert
    expect(result.current.getActiveSearchId(2)).toBeUndefined();
    expect(result.current.getActiveSearchId(3)).toBe(8);
  });
});

function feed(id: number, overrides: Partial<FeedSummary> = {}): FeedSummary {
  return { id, link: `https://example.com/feed-${id}`, showInWorkspace: 1, ...overrides } as FeedSummary;
}

function Providers({ children }: PropsWithChildren) {
  return (
    <PreferencesProvider>
      <SearchProvider>
        <RiverScopeProvider>{children}</RiverScopeProvider>
      </SearchProvider>
    </PreferencesProvider>
  );
}

function renderScope(feeds: FeedSummary[], saved?: boolean) {
  return renderHook(() => ({
    river: useRiverScope(feeds, saved),
    feedSearch: useSearch(),
    savedSearch: useSearch(true),
    preferences: usePreferences(),
    activeSearch: useActiveSearchId(),
  }), { wrapper: Providers });
}

describe('useRiverScope', () => {
  afterEach(() => {
    localStorage.clear();
  });

  test('scopes Home to the ids of the feeds shown in the workspace', async () => {
    // Arrange
    const feeds = [feed(1), feed(2, { showInWorkspace: 0 }), feed(3)];

    // Act
    const { result } = await renderScope(feeds);

    // Assert
    expect(result.current.river.scope).toEqual({ workspaceId: HOME_WORKSPACE_ID, feedIds: [1, 3] });
    expect(result.current.river.visibleFeedIdsSet).toEqual(new Set([1, 3]));
    expect(result.current.river.debouncedSearch).toBe('');
  });

  test('narrows the scope to the focused feeds of the active workspace', async () => {
    // Arrange
    const focused = feed(2);
    const { result, act } = await renderScope([feed(1), focused, feed(3)]);

    // Act
    await act(() => result.current.river.setShowOnlyLinks(() => new Set([focused.link])));

    // Assert
    expect(result.current.river.scope).toEqual({ workspaceId: HOME_WORKSPACE_ID, feedIds: [2] });
    expect(result.current.river.showOnlyLinks).toEqual(new Set([focused.link]));
  });

  test('scopes to the feeds, not to Saved, when the caller does not say', async () => {
    // Arrange
    const { result } = await renderScope([feed(1)], undefined);

    // Assert
    expect(result.current.river.scope).toEqual({ workspaceId: HOME_WORKSPACE_ID, feedIds: [1] });
  });

  test('keeps the focus and the selected saved search per workspace while the hook stays mounted', async () => {
    // Arrange
    const focused = feed(2);
    const { result, goToWorkspace } = await renderHookInWorkspace(
      () => ({ river: useRiverScope([feed(1), focused]), active: useActiveSearchId() }),
      { wrapper: Providers },
    );

    // Act
    await goToWorkspace(3);
    await act(async () => {
      result.current.river.setShowOnlyLinks(() => new Set([focused.link]));
      result.current.active[1](9);
    });
    await goToWorkspace(1);

    // Assert
    expect(result.current.river.showOnlyLinks).toEqual(new Set());
    expect(result.current.active[0]).toBeUndefined();
    await goToWorkspace(3);
    expect(result.current.river.showOnlyLinks).toEqual(new Set([focused.link]));
    expect(result.current.active[0]).toBe(9);
  });

  test('hides the read items only when the preference is on', async () => {
    // Arrange
    const { result, act } = await renderScope([feed(1)]);
    expect(result.current.river.scope).not.toHaveProperty('unreadOnly');

    // Act
    await act(() => result.current.preferences.setPreference('hideReadItems', true));

    // Assert
    expect(result.current.river.scope).toEqual({ workspaceId: HOME_WORKSPACE_ID, feedIds: [1], unreadOnly: true });
  });

  test('Saved scopes to the saved items, whatever the feeds and the hide-read preference', async () => {
    // Arrange
    const feeds = [feed(1), feed(2)];
    const { result, act } = await renderScope(feeds, true);

    // Act
    await act(() => result.current.preferences.setPreference('hideReadItems', true));

    // Assert
    expect(result.current.river.scope).toEqual({ workspaceId: HOME_WORKSPACE_ID, saved: true });
  });

  test('adds the trimmed search only after the typing pauses', async () => {
    // Arrange
    const { result, act } = await renderScope([feed(1)]);

    // Act
    await act(() => result.current.feedSearch.setQuery('  rust  '));

    // Assert
    expect(result.current.river.scope).not.toHaveProperty('search');
    expect(result.current.river.debouncedSearch).toBe('');
    await vi.waitFor(() => {
      expect(result.current.river.scope).toEqual({ workspaceId: HOME_WORKSPACE_ID, feedIds: [1], search: 'rust' });
    });
    expect(result.current.river.debouncedSearch).toBe('rust');
  });

  test('a search of spaces adds no search to the scope', async () => {
    // Arrange
    const { result, act } = await renderScope([feed(1)]);

    // Act
    await act(() => result.current.feedSearch.setQuery('   '));
    await new Promise((resolve) => setTimeout(resolve, 350));

    // Assert
    expect(result.current.river.scope).not.toHaveProperty('search');
  });

  test('Saved searches with its own query, apart from the one of the feeds', async () => {
    // Arrange
    const { result, act } = await renderScope([feed(1)], true);

    // Act
    await act(() => {
      result.current.feedSearch.setQuery('feeds only');
      result.current.savedSearch.setQuery('saved only');
    });

    // Assert
    await vi.waitFor(() => {
      expect(result.current.river.scope).toEqual({ workspaceId: HOME_WORKSPACE_ID, saved: true, search: 'saved only' });
    });
  });
});

describe('useActiveSearchId', () => {
  test('selects and clears the saved search of the active workspace only', async () => {
    // Arrange
    const { result, act } = await renderHook(() => ({ scope: useRiverScopeState(), active: useActiveSearchId() }), { wrapper: RiverScopeProvider });
    expect(result.current.active[0]).toBeUndefined();

    // Act
    await act(() => result.current.active[1](6));
    await act(() => result.current.scope.setActiveSearchId(2, 9));

    // Assert
    expect(result.current.active[0]).toBe(6);
    expect(result.current.scope.getActiveSearchId(HOME_WORKSPACE_ID)).toBe(6);

    // Act
    await act(() => result.current.active[1](undefined));

    // Assert
    expect(result.current.active[0]).toBeUndefined();
    expect(result.current.scope.getActiveSearchId(2)).toBe(9);
  });
});
