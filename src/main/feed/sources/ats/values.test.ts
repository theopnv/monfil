// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { asRec, firstSegment, isoFromText, joinParts, str } from './values';

describe('asRec', () => {
  test('returns an object as is', () => {
    // Arrange
    const value = { a: 1 };

    // Act / Assert
    expect(asRec(value)).toBe(value);
  });

  test.each([null, undefined, [], [1], 'text', 5, true])('reads %j as an empty record', (value) => {
    // Act / Assert
    expect(asRec(value)).toEqual({});
  });
});

describe('str', () => {
  test.each([
    ['text', 'text'],
    ['  padded \n', 'padded'],
    [42, '42'],
    [0, '0'],
    [-1.5, '-1.5'],
  ])('reads %j as %j', (value, expected) => {
    // Act / Assert
    expect(str(value)).toBe(expected);
  });

  test.each(['', '   ', '\n\t', Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY, null, undefined, true, {}, []])('reads %j as undefined', (value) => {
    // Act / Assert
    expect(str(value)).toBeUndefined();
  });
});

describe('joinParts', () => {
  test('joins the present parts once each, with the given separator', () => {
    // Act / Assert
    expect(joinParts(['Paris', undefined, 'France', 'Paris'])).toBe('Paris, France');
    expect(joinParts(['a', 'b'], ' · ')).toBe('a · b');
  });

  test('returns undefined without a present part', () => {
    // Act / Assert
    expect(joinParts([undefined, undefined])).toBeUndefined();
    expect(joinParts([])).toBeUndefined();
  });
});

describe('firstSegment', () => {
  test.each([
    ['https://jobs.example.com/acme/jobs/1', 'acme'],
    ['https://jobs.example.com//acme', 'acme'],
    ['https://jobs.example.com/', undefined],
  ])('reads the first path segment of %s', (link, expected) => {
    // Act / Assert
    expect(firstSegment(new URL(link))).toBe(expected);
  });
});

describe('isoFromText', () => {
  test.each([
    ['2026-05-29', '2026-05-29T00:00:00.000Z'],
    ['2026-03-01T09:00:00.000+00:00', '2026-03-01T09:00:00.000Z'],
    ['2026-01-05T10:00:00-05:00', '2026-01-05T15:00:00.000Z'],
    ['  2026-05-29  ', '2026-05-29T00:00:00.000Z'],
    ['2026-10-15 09:31:36 UTC', '2026-10-15T09:31:36.000Z'],
  ])('reads %j as %j', (value, expected) => {
    // Act / Assert
    expect(isoFromText(value)).toBe(expected);
  });

  test.each([ undefined, 20260529])('reads %j as an empty string', (value) => {
    // Act / Assert
    expect(isoFromText(value)).toBe('');
  });
});
