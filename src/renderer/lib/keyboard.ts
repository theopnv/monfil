// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

// Stryker disable next-line ConditionalExpression: the renderer only runs in a browser, where navigator is always defined
const IS_MAC = typeof navigator !== 'undefined' && navigator.userAgent.includes('Mac');

/** The label of the platform's shortcut modifier: ⌘ on macOS, Ctrl elsewhere. */
export const MOD_KEY_LABEL = IS_MAC ? '⌘' : 'Ctrl+';

/** Whether only the platform's shortcut modifier is held: ⌘ on macOS, Ctrl elsewhere. */
export function hasOnlyModKey(event: Pick<KeyboardEvent, 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>): boolean {
  const mod = IS_MAC ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey;
  return mod && !event.altKey && !event.shiftKey;
}
