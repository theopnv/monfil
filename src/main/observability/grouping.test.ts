// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import type { Exception } from '@sentry/electron/main';
import { collapseExceptions, fingerprintOf } from './grouping';

function failure(value: string, line = 1): Exception {
  return { type: 'Error', value, stacktrace: { frames: [{ filename: 'query.ts', function: 'querySettings', lineno: line }] } };
}

describe('collapseExceptions', () => {
  test('keeps one copy of an error that repeats, with the thrown error last', () => {
    // Arrange
    const repeated = Array.from({ length: 183 }, () => failure('driver has already been destroyed'));
    const thrown: Exception = { type: 'AggregateError', value: 'Multiple workers failed' };

    // Act
    const collapsed = collapseExceptions([...repeated, thrown]);

    // Assert
    expect(collapsed).toEqual([failure('driver has already been destroyed'), thrown]);
  });

  test.each([
    ['message', failure('a'), failure('b')],
    ['line', failure('a', 1), failure('a', 2)],
    ['type', failure('a'), { ...failure('a'), type: 'TypeError' }],
  ])('keeps two errors that differ by their %s', (_label, first, second) => {
    // Act, Assert
    expect(collapseExceptions([first, second])).toEqual([first, second]);
  });

  test('keeps an error without a stack or a type next to one that has them', () => {
    // Arrange
    const bare: Exception = { value: 'a' };

    // Act, Assert
    expect(collapseExceptions([bare, failure('a')])).toEqual([bare, failure('a')]);
  });

  test('keeps the newest ten of a longer chain', () => {
    // Arrange
    const chain = Array.from({ length: 25 }, (_, index) => failure(`error ${index}`));

    // Act
    const collapsed = collapseExceptions(chain);

    // Assert
    expect(collapsed).toEqual(chain.slice(-10));
  });

  test('leaves an empty chain empty', () => {
    // Act, Assert
    expect(collapseExceptions([])).toEqual([]);
  });
});

describe('fingerprintOf', () => {
  test('groups a closed database under one fingerprint, whichever query hit it', () => {
    // Act, Assert
    expect(fingerprintOf([failure('driver has already been destroyed')])).toEqual(['database', 'driver-destroyed']);
    expect(fingerprintOf([{ type: 'AggregateError', value: 'Multiple workers failed' }, failure('driver has already been destroyed', 9)])).toEqual(['database', 'driver-destroyed']);
  });

  test.each([
    ['another error', [failure('boom')]],
    ['an error without a message', [{ type: 'Error' }]],
    ['no error', []],
  ])('leaves the default grouping for %s', (_label, exceptions) => {
    // Act, Assert
    expect(fingerprintOf(exceptions)).toBeUndefined();
  });
});
