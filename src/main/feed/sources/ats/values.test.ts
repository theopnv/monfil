// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test } from 'vitest';
import { asArray, asRec, firstSegment, isoFromMs, isoFromText, joinParts, num, parseJson, str } from './values';

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

describe('asArray', () => {
  test('returns an array as is', () => {
    // Arrange
    const value = [1, 'a'];

    // Act / Assert
    expect(asArray(value)).toBe(value);
  });

  test.each([null, undefined, {}, 'text', 5])('reads %j as an empty array', (value) => {
    // Act / Assert
    expect(asArray(value)).toEqual([]);
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

describe('num', () => {
  test.each([0, 7, -3, 1.5])('keeps the finite number %j', (value) => {
    // Act / Assert
    expect(num(value)).toBe(value);
  });

  test.each([Number.NaN, Number.POSITIVE_INFINITY, '7', null, undefined, true])('reads %j as undefined', (value) => {
    // Act / Assert
    expect(num(value)).toBeUndefined();
  });
});

describe('parseJson', () => {
  test('parses valid JSON and returns undefined for the rest', () => {
    // Act / Assert
    expect(parseJson('{"a": [1]}')).toEqual({ a: [1] });
    expect(parseJson('<html>')).toBeUndefined();
    expect(parseJson('')).toBeUndefined();
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

describe('isoFromMs', () => {
  test('formats a millisecond timestamp and gives an empty string for anything else', () => {
    // Act / Assert
    expect(isoFromMs(1767225600000)).toBe('2026-01-01T00:00:00.000Z');
    expect(isoFromMs(0)).toBe('1970-01-01T00:00:00.000Z');
    expect(isoFromMs('1767225600000')).toBe('');
    expect(isoFromMs(undefined)).toBe('');
    expect(isoFromMs(Number.NaN)).toBe('');
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

  test.each(['', '   ', 'soon', '2026-13-45', '2026-10-15 09:31:36 UTCX', 'x2026-10-15 09:31:36 UTC', '2026-10-15 99:99:99 UTC', null, undefined, 20260529])('reads %j as an empty string', (value) => {
    // Act / Assert
    expect(isoFromText(value)).toBe('');
  });
});
