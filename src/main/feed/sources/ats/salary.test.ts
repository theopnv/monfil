// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { describe, expect, test, vi } from 'vitest';
import { intervalFromProvider, salaryFromRange, salaryFromText } from './salary';

vi.mock(import('../../../lib/fetch'), () => ({ fetchText: vi.fn(), fetchConditional: vi.fn() }));

describe('salaryFromText', () => {
  test.each([
    ['The range is $150,000–$190,000 per year plus equity.', '$150,000–$190,000 / year'],
    ['<p>Salary: $115,000 &mdash; $155,000 USD</p>', '$115,000 — $155,000 USD'],
    ['Rémunération : 45 000 € - 55 000 € par an', '45 000 € - 55 000 € / year'],
    ['Pay is €60k–€75k', '€60k–€75k'],
    ['£50,000 to £70,000 annually', '£50,000 to £70,000 / year'],
    ['NOK 700 000 - 900 000 per year', 'NOK 700 000 - 900 000 / year'],
    ['Between 3 500 € and 4 200 € par mois', '3 500 € and 4 200 € / month'],
    ['$45 - $60 per hour', '$45 - $60 / hour'],
    ['Paid $35/hr', '$35 / hour'],
    ['USD 120,000 - 150,000', 'USD 120,000 - 150,000'],
  ])('reads %j', (text, expected) => {
    // Act / Assert
    expect(salaryFromText(text)).toBe(expected);
  });

  test.each([
    'We raised $100M - $200M in funding',
    'Team of 10 - 20 people',
    'Experience: 3 - 5 years',
    'Founded between 2010 and 2015',
    'No pay information here',
    '',
  ])('finds nothing in %j', (text) => {
    // Act / Assert
    expect(salaryFromText(text)).toBeUndefined();
  });
});

describe('salaryFromRange', () => {
  test('formats a range with a symbol or a code and the interval', () => {
    // Act / Assert
    expect(salaryFromRange(150000, 190000, 'USD', 'year')).toBe('$150,000–$190,000 / year');
    expect(salaryFromRange(45000, 55000, 'eur', undefined)).toBe('€45,000–€55,000');
    expect(salaryFromRange(700000, 900000, 'NOK', 'year')).toBe('NOK 700,000–NOK 900,000 / year');
    expect(salaryFromRange(30, 30, 'GBP', 'hour')).toBe('£30 / hour');
    expect(salaryFromRange(undefined, 90000, 'USD', 'year')).toBe('$90,000 / year');
  });

  test('gives no label without a currency or without an amount', () => {
    // Act / Assert
    expect(salaryFromRange(1, 2, undefined, 'year')).toBeUndefined();
    expect(salaryFromRange(undefined, undefined, 'USD', 'year')).toBeUndefined();
    expect(salaryFromRange(0, 0, 'USD', 'year')).toBeUndefined();
  });
});

describe('intervalFromProvider', () => {
  test.each([
    ['per-year-salary', 'year'], ['1 YEAR', 'year'], ['per-hour-wage', 'hour'], ['month', 'month'], ['weekly', undefined], [undefined, undefined],
  ] as const)('maps %j to %j', (value, expected) => {
    // Act / Assert
    expect(intervalFromProvider(value)).toBe(expected);
  });
});
