// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { readLocalStorageJSON, writeLocalStorageJSON } from '@/lib/local-storage';

/** The order a new user meets the hints in. A hint never opens before the ones ahead of it are seen. */
export const HINT_ORDER = ['add-feed', 'filter', 'save', 'workspace'] as const;

export type HintId = (typeof HINT_ORDER)[number];

export interface HintsState {
  /** Set once the first-run check decided whether this profile gets hints at all. */
  initialized: boolean;
  seen: HintId[];
}

export const HINTS_STORAGE_KEY = 'hints-state';

const isHintId = (value: unknown): value is HintId => HINT_ORDER.some((id) => id === value);

export function readHintsState(): HintsState {
  const stored = readLocalStorageJSON(HINTS_STORAGE_KEY);
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) {
    return { initialized: false, seen: [] };
  }
  const { initialized, seen } = stored as { initialized?: unknown; seen?: unknown };
  return {
    initialized: initialized === true,
    seen: Array.isArray(seen) ? seen.filter(isHintId) : [],
  };
}

export function writeHintsState(state: HintsState): void {
  writeLocalStorageJSON(HINTS_STORAGE_KEY, state);
}

/**
 * The one hint allowed to be open: the first unseen hint in `HINT_ORDER`, provided its anchor is
 * mounted and ready. `anchors` maps each mounted anchor to its `ready` flag.
 */
export function activeHint(seen: ReadonlySet<HintId>, anchors: ReadonlyMap<HintId, boolean>): HintId | undefined {
  const next = HINT_ORDER.find((id) => !seen.has(id));
  return next !== undefined && anchors.get(next) === true ? next : undefined;
}
