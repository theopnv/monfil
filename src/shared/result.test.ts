// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { fail, ipcFailure, isIpcFailure, ok } from './result';

describe('ipcFailure', () => {
  test('describes a payload that did not pass its guard', () => {
    // Act & Assert
    expect(ipcFailure('INVALID_PAYLOAD')).toEqual({ success: false, error: { name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' } });
  });

  test('carries the incident ID of an unexpected error', () => {
    // Act & Assert
    expect(ipcFailure('UNEXPECTED_ERROR', 'abc')).toEqual({
      success: false,
      error: { name: 'UNEXPECTED_ERROR', message: 'The operation could not be completed.', incidentId: 'abc' },
    });
  });
});

describe('isIpcFailure', () => {
  test.each([ipcFailure('INVALID_PAYLOAD'), ipcFailure('UNEXPECTED_ERROR', 'abc')])('accepts %j', (response) => {
    // Act & Assert
    expect(isIpcFailure(response)).toBe(true);
  });

  test.each([
    undefined,
    null,
    'failure',
    [],
    { success: true, data: 1 },
    { success: false },
    { success: false, error: null },
    { success: false, error: { name: 'DB_ERROR', message: 'A domain failure.' } },
    { success: false, error: { name: 'INVALID_PAYLOAD' } },
    { success: false, error: { name: 'INVALID_PAYLOAD', message: '' } },
    { success: false, error: { name: 'UNEXPECTED_ERROR', message: 'Failed.' } },
    { success: false, error: { name: 'UNEXPECTED_ERROR', message: 'Failed.', incidentId: '' } },
  ])('rejects %j', (response) => {
    // Act & Assert
    expect(isIpcFailure(response)).toBe(false);
  });
});

describe('ok', () => {
  test('wraps data, or nothing', () => {
    // Act & Assert
    expect(ok(3)).toStrictEqual({ success: true, data: 3 });
    expect(ok()).toStrictEqual({ success: true, data: undefined });
  });
});

describe('fail', () => {
  test('leaves params out when the caller gives none', () => {
    // Act & Assert
    expect(fail('DB_ERROR', 'Broken.')).toStrictEqual({ success: false, error: { name: 'DB_ERROR', message: 'Broken.' } });
  });

  test('carries the params that fill the message', () => {
    // Act & Assert
    expect(fail('DUPLICATE_NAME', 'Taken.', { name: 'Tech' })).toStrictEqual({ success: false, error: { name: 'DUPLICATE_NAME', message: 'Taken.', params: { name: 'Tech' } } });
  });
});
