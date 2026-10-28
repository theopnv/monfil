// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, test } from 'vitest';
import { reorderIds } from './reorder';

test('moves an id before the target', () => {
  // Act
  const result = reorderIds([1, 2, 3, 4], new Set([4]), 2, 'before');

  // Assert
  expect(result).toEqual([1, 4, 2, 3]);
});

test('moves an id after the target', () => {
  // Act
  const result = reorderIds([1, 2, 3, 4], new Set([1]), 3, 'after');

  // Assert
  expect(result).toEqual([2, 3, 1, 4]);
});

test('moves an id after the last one', () => {
  // Act
  const result = reorderIds([1, 2, 3], new Set([1]), 3, 'after');

  // Assert
  expect(result).toEqual([2, 3, 1]);
});

test('keeps several moved ids in their relative order', () => {
  // Act
  const result = reorderIds([1, 2, 3, 4, 5], new Set([4, 2]), 1, 'before');

  // Assert
  expect(result).toEqual([2, 4, 1, 3, 5]);
});

test('keeps the order when the target is one of the moved ids', () => {
  // Act
  const result = reorderIds([1, 2, 3], new Set([2]), 2, 'before');

  // Assert
  expect(result).toEqual([1, 2, 3]);
});

test('keeps the order when the target is one of the moved ids and the drop is after it', () => {
  // Act
  const result = reorderIds([1, 2, 3], new Set([2]), 2, 'after');

  // Assert
  expect(result).toEqual([1, 2, 3]);
});
