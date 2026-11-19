// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { createI18n } from '../../../shared/i18n/create-i18n';
import { categoryErrorMessage } from './category-errors';

const t = createI18n('en').getFixedT('en', 'errors');

describe('category error message', () => {
  test.each([
    { name: 'CATEGORY_NOT_FOUND', expected: 'That folder no longer exists.' },
    { name: 'DUPLICATE_NAME', expected: 'A folder with that name already exists.' },
    { name: 'DB_ERROR', expected: 'The folder could not be saved.' },
  ] as const)('shows the folder message for $name, not the raw error text', ({ name, expected }) => {
    // Act
    const message = categoryErrorMessage(t, { name, message: 'SQLITE_CONSTRAINT: raw detail' });

    // Assert
    expect(message).toBe(expected);
  });
});
