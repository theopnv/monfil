// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

let shuttingDown = false;

/** True once the app began to quit. From then on the database may close at any moment, so background work must not touch it. */
export function isShuttingDown(): boolean {
  return shuttingDown;
}

export function markShuttingDown(): void {
  shuttingDown = true;
}

/** Lets a test start a new run. */
export function resetShutdownState(): void {
  shuttingDown = false;
}
