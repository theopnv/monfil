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

/** Whether the physical key is the given letter, whatever the keyboard layout types for it. */
export function isLetterCode(event: Pick<KeyboardEvent, 'code'>, letter: string): boolean {
  return event.code === `Key${letter.toUpperCase()}`;
}

/** The digit 1 to 9 of the physical digit-row key, or null for any other key. */
export function digitFromCode(event: Pick<KeyboardEvent, 'code'>): number | null {
  const match = /^Digit([1-9])$/.exec(event.code);
  return match ? Number(match[1]) : null;
}

/** Whether an IME is composing text. Enter and Escape then belong to the IME, so handlers must skip them. */
export function isComposing(event: Pick<KeyboardEvent, 'isComposing' | 'keyCode'>): boolean {
  // Safari sends keyCode 229 for the Enter that ends a composition, after isComposing is already false.
  return event.isComposing || event.keyCode === 229;
}
