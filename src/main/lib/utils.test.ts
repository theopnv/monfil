// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { runWithConcurrency } from './utils';

describe('runWithConcurrency', () => {
  test('finishes queued work after a worker fails', async () => {
    // Arrange
    const failure = new Error('bad item');
    const completed: number[] = [];
    const operation = runWithConcurrency([1, 2, 3], 1, async (item) => {
      if (item === 2) {
        throw failure;
      }
      completed.push(item);
    });

    // Act
    await expect(operation).rejects.toBe(failure);

    // Assert
    expect(completed).toEqual([1, 3]);
  });

  test('throws every failure together after the queue is done when several workers fail', async () => {
    // Arrange
    const first = new Error('item 1');
    const third = new Error('item 3');
    const completed: number[] = [];

    // Act
    const outcome = await runWithConcurrency([1, 2, 3], 1, async (item) => {
      if (item === 1) {
        throw first;
      }
      if (item === 3) {
        throw third;
      }
      completed.push(item);
    }).catch((error: unknown) => error);

    // Assert
    expect(outcome).toBeInstanceOf(AggregateError);
    expect((outcome as AggregateError).errors).toEqual([first, third]);
    expect(completed).toEqual([2]);
  });
});
