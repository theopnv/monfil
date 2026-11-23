// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { paginate } from './paging';

describe('paginate', () => {
  test('drops the extra row and returns the last row of the page when more rows follow', () => {
    // Act
    const { page, last } = paginate([1, 2, 3], 2);

    // Assert
    expect(page).toEqual([1, 2]);
    expect(last).toBe(2);
  });

  test.each([[[1, 2], 2]])('returns every row and no last row for %j with a limit of %i', (rows, limit) => {
    // Act
    const { page, last } = paginate(rows, limit);

    // Assert
    expect(page).toEqual(rows);
    expect(last).toBeUndefined();
  });
});
