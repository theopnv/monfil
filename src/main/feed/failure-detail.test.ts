// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { failureDetail } from './failure-detail';

describe('failureDetail', () => {
  test('keeps the status and the reason of an HTTP failure', () => {
    // Act, Assert
    expect(failureDetail({ name: 'GENERIC_FETCH_ERROR', message: 'HTTP 403', params: { reason: 'refused', status: 403 } })).toEqual({ status: 403, reason: 'refused' });
  });

  test('never passes on the host of an unresolved name', () => {
    // Act
    const detail = failureDetail({ name: 'NETWORK_ERROR', message: 'Could not resolve private.example.', params: { reason: 'unresolvable', host: 'private.example' } });

    // Assert
    expect(detail).toEqual({ reason: 'unresolvable' });
  });

  test.each([
    ['a reason that is not a fetch reason', { reason: 'Could not fetch My Private Pack' }],
    ['a status that is not a number', { status: '403' }],
    ['a status outside the HTTP range', { status: 42 }],
    ['a status that is not whole', { status: 404.5 }],
    ['a status above the HTTP range', { status: 600 }],
  ])('leaves out %s', (_label, params) => {
    // Act, Assert
    expect(failureDetail({ name: 'GENERIC_FETCH_ERROR', message: 'x', params })).toEqual({});
  });

  test.each([[100], [599]])('keeps the status %s at the edge of the HTTP range', (status) => {
    // Act, Assert
    expect(failureDetail({ name: 'GENERIC_FETCH_ERROR', message: 'x', params: { status } })).toEqual({ status });
  });

  test('gives nothing for a failure without params', () => {
    // Act, Assert
    expect(failureDetail({ name: 'PARSE_ERROR', message: 'x' })).toEqual({});
  });
});
