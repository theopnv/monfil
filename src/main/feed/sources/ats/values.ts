// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export type Rec = Record<string, unknown>;

export function asRec(value: unknown): Rec {
  return typeof value === 'object' && value !== null && !Array.isArray(value) ? value as Rec : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(value: unknown): string | undefined {
  // Stryker disable next-line ConditionalExpression: Number.isFinite is false for every non-number without coercion
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value !== 'string') {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

export function num(value: unknown): number | undefined {
  // Stryker disable next-line ConditionalExpression: Number.isFinite is false for every non-number without coercion
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

export function parseJson(body: string): unknown {
  try {
    return JSON.parse(body);
  } catch {
    return undefined;
  }
}

/** The values of a list that are present, joined as a location or similar label. */
export function joinParts(parts: (string | undefined)[], separator = ', '): string | undefined {
  const present = [...new Set(parts.filter((part): part is string => part !== undefined))];
  return present.length > 0 ? present.join(separator) : undefined;
}

/** The first path segment of a URL, which is the company slug on most job boards. */
export function firstSegment(url: URL): string | undefined {
  return url.pathname.split('/').find((segment) => segment !== '');
}

export function isoFromMs(value: unknown): string {
  const ms = num(value);
  return ms === undefined ? '' : new Date(ms).toISOString();
}

export function isoFromText(value: unknown): string {
  const text = str(value);
  if (!text) {
    return '';
  }
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2} UTC$/.test(text) ? `${text.slice(0, 10)}T${text.slice(11, 19)}Z` : text;
  const time = Date.parse(normalized);
  return Number.isNaN(time) ? '' : new Date(time).toISOString();
}
