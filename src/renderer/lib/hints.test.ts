// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test } from 'vitest';
import { activeHint, HINT_ORDER, HINTS_STORAGE_KEY, readHintsState, writeHintsState, type HintId } from './hints';

beforeEach(() => {
  localStorage.clear();
});

const allReady = new Map<HintId, boolean>(HINT_ORDER.map((id) => [id, true]));

describe('HINT_ORDER', () => {
  test('lists the hints in the order a new user meets them', () => {
    expect(HINT_ORDER).toEqual(['add-feed', 'filter', 'save', 'workspace']);
  });
});

describe('activeHint', () => {
  test('is the first hint when nothing was seen', () => {
    expect(activeHint(new Set(), allReady)).toBe('add-feed');
  });

  test('skips the hints already seen', () => {
    expect(activeHint(new Set<HintId>(['add-feed']), allReady)).toBe('filter');
  });

  test('waits for the first unseen hint to be registered, even if later hints are ready', () => {
    // Arrange
    const anchors = new Map<HintId, boolean>([['save', true], ['workspace', true]]);

    // Assert
    expect(activeHint(new Set<HintId>(['add-feed']), anchors)).toBeUndefined();
  });

  test('waits for the first unseen hint to be ready, even if later hints are ready', () => {
    // Arrange
    const anchors = new Map<HintId, boolean>([['filter', false], ['save', true], ['workspace', true]]);

    // Assert
    expect(activeHint(new Set<HintId>(['add-feed']), anchors)).toBeUndefined();
  });

  test('is undefined once every hint was seen', () => {
    expect(activeHint(new Set<HintId>(HINT_ORDER), allReady)).toBeUndefined();
  });
});

describe('readHintsState', () => {
  test('starts uninitialized when nothing is stored', () => {
    expect(readHintsState()).toEqual({ initialized: false, seen: [] });
  });

  test('round-trips what was written', () => {
    // Act
    writeHintsState({ initialized: true, seen: ['add-feed', 'filter'] });

    // Assert
    expect(readHintsState()).toEqual({ initialized: true, seen: ['add-feed', 'filter'] });
  });

  test('stores the state under the hints-state key', () => {
    // Act
    writeHintsState({ initialized: true, seen: [] });

    // Assert
    expect(JSON.parse(localStorage.getItem(HINTS_STORAGE_KEY) ?? 'null')).toEqual({ initialized: true, seen: [] });
  });

  test('drops unknown ids', () => {
    // Arrange
    localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify({ initialized: true, seen: ['add-feed', 'nope', 3] }));

    // Assert
    expect(readHintsState()).toEqual({ initialized: true, seen: ['add-feed'] });
  });

  test('treats a malformed value as uninitialized', () => {
    // Arrange
    localStorage.setItem(HINTS_STORAGE_KEY, JSON.stringify(['add-feed']));

    // Assert
    expect(readHintsState()).toEqual({ initialized: false, seen: [] });
  });
});
