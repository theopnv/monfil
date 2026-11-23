// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { useTestDatabase } from '../test/db';
import { dbTry, hasSqliteCode } from './db-try';

useTestDatabase();

describe('dbTry', () => {

  test.each([
    ['the default message', undefined, 'An unknown error occurred'],
  ])('gives %s for a thrown value that is not an Error', async (_name, options, message) => {
    // Act
    const result = await dbTry(async () => {
      throw 'boom';
    }, options);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'DB_ERROR', message } });
  });
});

describe('hasSqliteCode', () => {
  test('matches the code of an Error', () => {
    // Arrange
    const error = Object.assign(new Error('unique'), { code: 'SQLITE_CONSTRAINT_UNIQUE' });

    // Act & Assert
    expect(hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE')).toBe(true);
    expect(hasSqliteCode(error, 'SQLITE_CONSTRAINT_FOREIGNKEY')).toBe(false);
  });

  test.each([new Error('no code'), { code: 'SQLITE_CONSTRAINT_UNIQUE' }, 'SQLITE_CONSTRAINT_UNIQUE', undefined])('rejects %j', (error) => {
    // Act & Assert
    expect(hasSqliteCode(error, 'SQLITE_CONSTRAINT_UNIQUE')).toBe(false);
  });
});
