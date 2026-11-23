// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { mainFormatLocale, setMainLanguage, setMainSystemLocale } from '../../../lib/i18n';
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
    ['USD 120,000 - 150,000', 'USD 120,000 - 150,000'],
    ['$1,200,000 – $1,500,000 per year', '$1,200,000 – $1,500,000 / year'],
    ['€60.000 - €75.000 per year', '€60.000 - €75.000 / year'],
    ['45\u00a0000 € - 55\u202f000 € par an', '45 000 € - 55 000 € / year'],
    ['$10.2500 - $15 per hour', '$10.2500 - $15 / hour'],
    ['$2500.750 - $3000 per month', '$2500.750 - $3000 / month'],
    ['€9,50 - €12 per hour', '€9,50 - €12 / hour'],
    ['$8 - $10 hourly', '$8 - $10 / hour'],
    ['€500 - €700 per month', '€500 - €700 / month'],
    ['€600 - €900 par mois', '€600 - €900 / month'],
    ['$1,000 - $2,000 per year', '$1,000 - $2,000 / year'],
    ['$1,000 - $2,000', '$1,000 - $2,000'],
    ['$50,000 - $50,000 per year', '$50,000 - $50,000 / year'],
    ['<strong>$100,000</strong> - <em>$120,000</em> per year', '$100,000 - $120,000 / year'],
    ['$100,000<br>to<br>$120,000 per year', '$100,000 to $120,000 / year'],
    ['$100,000   -   $120,000 per year', '$100,000 - $120,000 / year'],
  ])('reads %j', (text, expected) => {
    // Act / Assert
    expect(salaryFromText(text)).toBe(expected);
  });

  test.each([
    '$90,000 - $50,000 per year',
    '$500 - $900',
  ])('finds nothing in %j', (text) => {
    // Act / Assert
    expect(salaryFromText(text)).toBeUndefined();
  });
});

describe('salaryFromText around the range', () => {
  test('ignores a pay interval that is far from the range', () => {
    // Arrange
    const text = `Salary $100,000 - $120,000. ${'We value teamwork and curiosity. '.repeat(3)}Bonus is paid per year.`;

    // Act / Assert
    expect(salaryFromText(text)).toBe('$100,000 - $120,000');
  });

  test('collapses a long run of whitespace before it looks for the interval', () => {
    // Arrange
    const text = `<td>$100,000 - $120,000</td>${'\n        '.repeat(8)}<td>per year</td>`;

    // Act / Assert
    expect(salaryFromText(text)).toBe('$100,000 - $120,000 / year');
  });
});

describe('salaryFromRange', () => {
  test('formats a range with a symbol or a code and the interval', () => {
    // Act / Assert
    expect(salaryFromRange(150000, 190000, 'USD', 'year')).toBe('$150,000–$190,000 / year');
    expect(salaryFromRange(45000, 55000, 'eur', undefined)).toBe('€45,000–€55,000');
    expect(salaryFromRange(700000, 900000, 'NOK', 'year')).toBe('NOK\u00a0700,000–NOK\u00a0900,000 / year');
    expect(salaryFromRange(30, 30, 'GBP', 'hour')).toBe('£30 / hour');
    expect(salaryFromRange(undefined, 90000, 'USD', 'year')).toBe('$90,000 / year');
    expect(salaryFromRange(60000, undefined, 'USD', 'year')).toBe('$60,000 / year');
  });

  describe('in another interface language', () => {
    afterEach(async () => {
      await setMainLanguage('en');
      setMainSystemLocale('');
    });

    test('follows the regional system locale of the same language', async () => {
      // Arrange
      setMainSystemLocale('de-CH');
      await setMainLanguage('de');

      // Act
      const label = salaryFromRange(80000, 80000, 'USD', undefined);

      // Assert
      expect(mainFormatLocale()).toBe('de-CH');
      expect(label).toBe("$\u00a080'000");
    });
  });

  test('still gives a label for a currency code that Intl rejects', () => {
    // Act
    const label = salaryFromRange(1000, 2000, 'euros', 'year');

    // Assert
    expect(label).toBe('EUROS 1,000–EUROS 2,000 / year');
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
