// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { decodeText } from '../text';

export type SalaryInterval = 'hour' | 'month' | 'year';

const SYMBOLS: Record<string, string> = { USD: '$', EUR: '€', GBP: '£' };
const CURRENCY = String.raw`(?:[$€£]|USD|EUR|GBP|NOK|SEK|DKK|CHF|CAD|AUD)`;
const NUMBER = String.raw`\d{1,3}(?:[ ,.\u00a0\u202f]\d{3})+|\d+(?:[.,]\d+)?`;
// A trailing M or B means millions or billions ("$100M funding"), never a pay.
const AMOUNT = String.raw`(?:${CURRENCY}\s?)?(?:${NUMBER})(?:\s?[kK]\b)?(?!\s?(?:[mMbB]\b|million|billion|bn\b))(?:\s?${CURRENCY})?`;
const RANGE = new RegExp(String.raw`(${AMOUNT})\s*(?:[-–—]|to|à|and)\s*(${AMOUNT})`, 'iu');
const SINGLE_HOURLY = new RegExp(String.raw`(${CURRENCY}\s?\d+(?:[.,]\d+)?)\s?(?:\/\s?h(?:ou)?r|per hour|an hour|de l'heure)`, 'iu');

const INTERVALS: [RegExp, SalaryInterval][] = [
  [/\b(per hour|\/\s?h(?:ou)?r|hourly|par heure|de l'heure|an hour)\b|\/h\b/i, 'hour'],
  [/\b(per month|\/\s?mo(?:nth)?|monthly|par mois|mensuel)\b/i, 'month'],
  [/\b(per year|\/\s?y(?:ea)?r|annual(?:ly)?|yearly|par an|annuel|a year|p\.a\.|per annum)\b/i, 'year'],
];

function hasCurrency(text: string): boolean {
  return new RegExp(CURRENCY, 'u').test(text);
}

function intervalIn(text: string): SalaryInterval | undefined {
  return INTERVALS.find(([pattern]) => pattern.test(text))?.[1];
}

function withInterval(label: string, interval: SalaryInterval | undefined): string {
  return interval ? `${label} / ${interval}` : label;
}

function plainNumber(raw: string): number {
  const digits = raw.replace(/[^\d.,]/g, '');
  const grouped = /^\d{1,3}(?:[ ,.\u00a0\u202f]\d{3})+$/.test(raw.replace(/[^\d ,.\u00a0\u202f]/g, '').trim());
  return Number(grouped ? digits.replace(/[.,]/g, '') : digits.replace(',', '.'));
}

function isPlausible(first: string, second: string, interval: SalaryInterval | undefined): boolean {
  const low = plainNumber(first) * (/\dk\b/i.test(first) ? 1000 : 1);
  const high = plainNumber(second) * (/\dk\b/i.test(second) ? 1000 : 1);
  const floor = interval === 'hour' ? 8 : interval === 'month' ? 500 : 1000;
  return high >= low && low >= floor;
}

/**
 * A salary label read from posting text, such as `$150,000–$190,000`, `45 000 € - 55 000 € par an`
 * or `€60k–€75k`. A range needs a currency on at least one side so that years and headcounts do not
 * read as pay.
 * @returns undefined when the text states no salary
 */
export function salaryFromText(text: string): string | undefined {
  const plain = decodeText(text.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ');
  const match = RANGE.exec(plain);
  if (match?.[1] && match[2] && hasCurrency(match[0])) {
    const after = plain.slice(match.index + match[0].length, match.index + match[0].length + 40);
    const interval = intervalIn(after);
    if (isPlausible(match[1], match[2], interval)) {
      return withInterval(match[0].replace(/\s+/g, ' ').trim(), interval);
    }
  }
  const hourly = SINGLE_HOURLY.exec(plain);
  return hourly?.[1] ? withInterval(hourly[1].trim(), 'hour') : undefined;
}

function formatMoney(value: number, currency: string): string {
  const symbol = SYMBOLS[currency.toUpperCase()];
  const amount = Math.round(value).toLocaleString('en-US');
  return symbol ? `${symbol}${amount}` : `${currency.toUpperCase()} ${amount}`;
}

/** Maps the interval words ATS APIs use ("per-year-salary", "1 YEAR", "month") to an interval. */
export function intervalFromProvider(value: string | undefined): SalaryInterval | undefined {
  const text = value?.toLowerCase() ?? '';
  if (text.includes('hour')) {
    return 'hour';
  }
  if (text.includes('month')) {
    return 'month';
  }
  return text.includes('year') || text.includes('annual') ? 'year' : undefined;
}

function hasAmount(min: number | undefined, max: number | undefined): boolean {
  return (min ?? 0) > 0 || (max ?? 0) > 0;
}

/** A label for a structured pay range. */
export function salaryFromRange(min: number | undefined, max: number | undefined, currency: string | undefined, interval: SalaryInterval | undefined): string | undefined {
  if (!currency || !hasAmount(min, max)) {
    return undefined;
  }
  const low = min ?? max ?? 0;
  const high = max ?? min ?? 0;
  const label = low === high ? formatMoney(low, currency) : `${formatMoney(low, currency)}–${formatMoney(high, currency)}`;
  return withInterval(label, interval);
}
