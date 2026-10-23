// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { UsagePreferences } from '../../shared/contracts';

let snapshot: UsagePreferences | undefined;

/** Keeps the last display settings the renderer reported. They live in memory only, and the renderer reports them again at each launch. */
export function setPreferencesSnapshot(preferences: UsagePreferences): void {
  snapshot = preferences;
}

export function getPreferencesSnapshot(): UsagePreferences | undefined {
  return snapshot;
}
