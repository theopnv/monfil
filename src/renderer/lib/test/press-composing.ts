// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/** Sends a keydown the way the browser does while an IME composes text. */
export function pressComposing(target: Element, key: string): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { key, code: key, isComposing: true, bubbles: true, cancelable: true }));
}
