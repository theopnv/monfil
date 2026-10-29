// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { categoryErrorMessage, categoryErrorPolicy } from './category-errors';

describe('category error policy', () => {
  test('uses a field for input errors', () => {
    // Arrange
    const errors = [categoryErrorPolicy.CATEGORY_NOT_FOUND, categoryErrorPolicy.DUPLICATE_NAME];

    // Act
    const surfaces = errors.map((entry) => entry.surface);

    // Assert
    expect(surfaces).toEqual(['field', 'field']);
  });

  test.each([
    { name: 'CATEGORY_NOT_FOUND', expected: 'That folder no longer exists.' },
    { name: 'DUPLICATE_NAME', expected: 'A folder with that name already exists.' },
    { name: 'DB_ERROR', expected: 'The folder could not be saved.' },
  ] as const)('shows the folder message for $name, not the raw error text', ({ name, expected }) => {
    // Act
    const message = categoryErrorMessage({ name, message: 'SQLITE_CONSTRAINT: raw detail' });

    // Assert
    expect(message).toBe(expected);
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
