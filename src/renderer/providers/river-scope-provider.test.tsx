// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { RiverScopeProvider, useRiverScopeState } from './river-scope-provider';

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
});
