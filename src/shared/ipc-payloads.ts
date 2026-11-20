// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { MenuKind, MenuTarget, RevealTarget } from './channels';
import { RENDERER_USAGE_COUNTERS } from './contracts';
import type { RendererUsageCounter, UsagePreferences } from './contracts';
import { isBoolean, isPositiveSafeInteger, object } from './guards';

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

