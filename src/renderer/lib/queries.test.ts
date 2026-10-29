// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { InfiniteData } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { mergeRiverRows, patchRiverRows, queryItemPage, queryKeys, RIVER_PAGE_SIZE } from './queries';
import type { RiverPage, RiverRow } from '../../shared/contracts';

const invoke = vi.fn();
const emptyPage: RiverPage = { rows: [] };

beforeEach(() => {
  invoke.mockReset();
  invoke.mockResolvedValue(emptyPage);
  window.electron = { ipcRenderer: { invoke, on: vi.fn(), once: vi.fn(), sendMessage: vi.fn() } };
});

function row(id: number, overrides: Partial<RiverRow> = {}): RiverRow {
  return {
    id,
    title: `Item ${id}`,
    link: undefined,
    publishedAt: id,
    excerpt: '',
    image: undefined,
    readAt: undefined,
    feedId: 1,
    feedTitle: 'Feed',
    feedLink: 'https://example.com/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    type: 'rss',
    ...overrides,
  };
}

function data(...pages: RiverRow[][]): InfiniteData<RiverPage> {
  return { pages: pages.map((rows) => ({ rows })), pageParams: pages.map(() => undefined) };
}

const ids = (result: InfiniteData<RiverPage>) => result.pages.map((page) => page.rows.map((r) => r.id));

describe('queryKeys.river', () => {
  test('gives one cache entry to scopes that list the same feeds in another order', () => {
    // Arrange
    const feedIds = [10, 9, 2];

    // Act
    const key = queryKeys.river({ workspaceId: 1, feedIds });
    const reordered = queryKeys.river({ workspaceId: 1, feedIds: [2, 10, 9] });

    // Assert
    expect(key).toStrictEqual(['river', { workspaceId: 1, feedIds: [2, 9, 10] }]);
    expect(reordered).toStrictEqual(key);
    expect(feedIds).toEqual([10, 9, 2]);
  });

  test('keeps a scope without feed ids free of that field', () => {
    // Act
    const key = queryKeys.river({ workspaceId: 1, search: 'rust' });

    // Assert
    expect(key).toStrictEqual(['river', { workspaceId: 1, search: 'rust' }]);
  });
});

describe('queryItemPage', () => {
  test('sends only the set filters to items:query, with the page size as the default limit', async () => {
    // Act
    await queryItemPage({ workspaceId: 3 });

    // Assert
    expect(invoke).toHaveBeenCalledExactlyOnceWith('items:query', { workspaceId: 3, limit: RIVER_PAGE_SIZE });
  });

  test('sends the cursor, the ids and the limit to items:query', async () => {
    // Arrange
    const cursor = { publishedAt: 5, id: 7 };

    // Act
    await queryItemPage({ workspaceId: 3, unreadOnly: true, search: 'rust', feedIds: [4] }, cursor, 20, [8, 9]);

    // Assert
    expect(invoke).toHaveBeenCalledExactlyOnceWith('items:query', {
      workspaceId: 3, unreadOnly: true, search: 'rust', feedIds: [4], limit: 20, cursor, ids: [8, 9],
    });
  });

  test('never sends the saved flag to items:query', async () => {
    // Act
    await queryItemPage({ workspaceId: 3, saved: false });

    // Assert
    expect(invoke.mock.calls[0]?.[1]).not.toHaveProperty('saved');
  });

  test('sends only the workspace and the limit to saved:query for a plain Saved view', async () => {
    // Act
    await queryItemPage({ workspaceId: 3, saved: true, feedIds: [1] });

    // Assert
    expect(invoke).toHaveBeenCalledExactlyOnceWith('saved:query', { workspaceId: 3, limit: RIVER_PAGE_SIZE });
  });

  test('sends the search, the unread filter, the ids and the cursor to saved:query', async () => {
    // Arrange
    const cursor = { publishedAt: 5, id: 7, savedAt: 9 };

    // Act
    await queryItemPage({ workspaceId: 3, saved: true, search: 'rust', unreadOnly: true }, cursor, 10, [1, 2]);

    // Assert
    expect(invoke).toHaveBeenCalledExactlyOnceWith('saved:query', {
      workspaceId: 3, limit: 10, search: 'rust', unreadOnly: true, ids: [1, 2], cursor,
    });
  });

  test('refuses a Saved cursor that has no save time, without asking the main process', async () => {
    // Act
    const result = queryItemPage({ workspaceId: 3, saved: true }, { publishedAt: 5, id: 7 });

    // Assert
    await expect(result).rejects.toThrow('Missing save time for Saved pagination.');
    expect(invoke).not.toHaveBeenCalled();
  });
});

describe('mergeRiverRows', () => {
  test('adds only the rows that are not loaded yet, at the end of the last page', () => {
    // Arrange
    const loaded = data([row(1), row(2)], [row(3)]);

    // Act
    const result = mergeRiverRows(loaded, [row(2), row(4), row(1), row(5)]);

    // Assert
    expect(ids(result)).toEqual([[1, 2], [3, 4, 5]]);
    expect(ids(loaded)).toEqual([[1, 2], [3]]);
  });

  test('returns the same data when every row is loaded already', () => {
    // Arrange
    const loaded = data([row(1)]);

    // Act
    const result = mergeRiverRows(loaded, [row(1)]);

    // Assert
    expect(result).toBe(loaded);
  });

  test('returns the same data when there is no page to add to', () => {
    // Arrange
    const loaded = data();

    // Act
    const result = mergeRiverRows(loaded, [row(1)]);

    // Assert
    expect(result).toBe(loaded);
  });
});

describe('patchRiverRows', () => {
  test('patches the rows with a target id on every page and leaves the others as they are', () => {
    // Arrange
    const loaded = data([row(1), row(2)], [row(3), row(4)]);

    // Act
    const result = patchRiverRows(loaded, new Set([2, 3]), (r) => ({ ...r, title: 'patched' }));

    // Assert
    expect(result.pages.map((page) => page.rows.map((r) => r.title))).toEqual([
      ['Item 1', 'patched'],
      ['patched', 'Item 4'],
    ]);
  });
});
