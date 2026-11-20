// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { MenuKind, MenuTarget, RevealTarget } from './channels';
import { RENDERER_USAGE_COUNTERS } from './contracts';
import type { RendererUsageCounter, UsagePreferences } from './contracts';
import { isPositiveSafeInteger } from './validation';

export type Guard<T> = (value: unknown) => value is T;

export function isString(value: unknown): value is string {
  return typeof value === 'string';
}

export function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

export function isUndefined(value: unknown): value is undefined {
  return value === undefined;
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function optional<T>(guard: Guard<T>): Guard<T | undefined> {
  return (value): value is T | undefined => value === undefined || guard(value);
}

export function array<T>(guard: Guard<T>): Guard<T[]> {
  return (value): value is T[] => {
    if (!Array.isArray(value)) {
      return false;
    }
    for (const item of value) {
      if (!guard(item)) {
        return false;
      }
    }
    return true;
  };
}

export function object<T extends object>(fields: { [K in keyof T]-?: Guard<T[K]> }): Guard<T> {
  return (value): value is T => {
    if (value === null || typeof value !== 'object') {
      return false;
    }
    const prototype: unknown = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    if (Reflect.ownKeys(value).some((key) => !Object.hasOwn(fields, key))) {
      return false;
    }
    const record = value as Record<keyof T, unknown>;
    return (Object.keys(fields) as (keyof T)[]).every((key) => fields[key](record[key]));
  };
}

function isRendererUsageCounter(value: unknown): value is RendererUsageCounter {
  return (RENDERER_USAGE_COUNTERS as readonly unknown[]).includes(value);
}

export function isRevealTarget(value: unknown): value is RevealTarget {
  return value === 'database' || value === 'log' || value === 'database-backup';
}

export const isMenuTarget = object<MenuTarget>({
  kind: (value): value is MenuKind => value === 'feed' || value === 'category' || value === 'workspace',
  id: isPositiveSafeInteger,
});

export const isRendererUsageRecord = object<{ counter: RendererUsageCounter }>({ counter: isRendererUsageCounter });

export const isUsagePreferences = object<UsagePreferences>({
  density: (value): value is UsagePreferences['density'] => value === 'Cards' || value === 'Magazine' || value === 'Compact',
  theme: (value): value is UsagePreferences['theme'] => value === 'light' || value === 'dark' || value === 'system',
  hideReadItems: isBoolean,
  markReadOnScroll: isBoolean,
  openLinksExternally: isBoolean,
  keyboardNavigation: isBoolean,
});

