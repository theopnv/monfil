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
});
