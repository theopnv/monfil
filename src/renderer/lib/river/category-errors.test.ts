import { describe, expect, test } from 'vitest';
import { categoryErrorPolicy } from './category-errors';

describe('category error policy', () => {
  test('uses a field for input errors', () => {
    // Arrange
    const errors = [categoryErrorPolicy.CATEGORY_NOT_FOUND, categoryErrorPolicy.DUPLICATE_NAME];

    // Act
    const surfaces = errors.map((entry) => entry.surface);

    // Assert
    expect(surfaces).toEqual(['field', 'field']);
  });

  test('uses a safe toast for database errors', () => {
    // Arrange
    const policy = categoryErrorPolicy.DB_ERROR;

    // Act
    const result = { surface: policy.surface, level: policy.level, retry: policy.retry, message: policy.message };

    // Assert
    expect(result).toEqual({ surface: 'toast', level: 'error', retry: 'none', message: 'The folder could not be saved.' });
  });
});
