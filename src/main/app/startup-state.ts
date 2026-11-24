// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

let complete = false;

/** True until the renderer reports its first river render. A failure in this window counts as a failed startup. */
export function isStartingUp(): boolean {
  return !complete;
}

export function markStartupComplete(): void {
  complete = true;
}

/** Lets a test start a new run. */
export function resetStartupState(): void {
  complete = false;
}
