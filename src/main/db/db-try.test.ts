// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { fail, ok } from '../../shared/result';
import { useTestDatabase } from '../test/db';
import { dbTry, hasSqliteCode } from './db-try';

useTestDatabase();

describe('dbTry', () => {
  test('returns what the callback returns', async () => {
    // Act
    const result = await dbTry(async () => ok(7));

    // Assert
    expect(result).toEqual({ success: true, data: 7 });
  });

  test('keeps a failure that the callback returns', async () => {
    // Act
    const result = await dbTry(async () => fail('NOT_FOUND', 'Gone.'));

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'NOT_FOUND', message: 'Gone.' } });
  });

  test('turns a thrown Error into a DB_ERROR with its message', async () => {
    // Act
    const result = await dbTry(async () => {
      throw new Error('disk full');
    });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'DB_ERROR', message: 'disk full' } });
  });

  test.each([
    ['the default message', undefined, 'An unknown error occurred'],
    ['the message of the caller', { fallback: 'Could not store it.' }, 'Could not store it.'],
  ])('gives %s for a thrown value that is not an Error', async (_name, options, message) => {
    // Act
    const result = await dbTry(async () => {
      throw 'boom';
    }, options);

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'DB_ERROR', message } });
  });

  test('lets the caller turn a known error into its own failure', async () => {
    // Act
    const result = await dbTry(async () => {
      throw new Error('known');
    }, { mapKnown: (error) => (error instanceof Error && error.message === 'known' ? fail('KNOWN', 'Mapped.') : undefined) });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'KNOWN', message: 'Mapped.' } });
  });

  test('falls back to DB_ERROR when the caller does not know the error', async () => {
    // Act
    const result = await dbTry(async () => {
      throw new Error('other');
    }, { mapKnown: () => undefined });

    // Assert
    expect(result).toEqual({ success: false, error: { name: 'DB_ERROR', message: 'other' } });
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
