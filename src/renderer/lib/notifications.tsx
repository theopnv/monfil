// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Toaster, toast } from 'sonner';

const activeKeys = new Set<string>();

export function notifyError(message: string, key = message): void {
  if (activeKeys.has(key)) {
    return;
  }
  activeKeys.add(key);
  toast.error(message, { id: key, onDismiss: () => activeKeys.delete(key), onAutoClose: () => activeKeys.delete(key) });
}

export function notifyWarning(message: string, key = message, action?: { label: string; onClick: () => void }): void {
  if (activeKeys.has(key)) {
    return;
  }
  activeKeys.add(key);
  // Stryker disable next-line ArrowFunction: the duration is Infinity, so a warning never auto-closes and onAutoClose never runs
  toast.warning(message, { id: key, action, duration: Infinity, onDismiss: () => activeKeys.delete(key), onAutoClose: () => activeKeys.delete(key) });
}

/** Shows a message that stays until the user acts on it or closes it. */
export function notifyAction(message: string, key: string, action: { label: string; onClick: () => void }): void {
  toast(message, { id: key, action, duration: Infinity });
}

/** Shows a short-lived message with an Undo button. */
export function notifyUndo(message: string, onUndo: () => void): void {
  toast(message, { action: { label: 'Undo', onClick: onUndo }, duration: 8000 });
}

export function dismissAllNotifications(): void {
  toast.dismiss();
}

export function NotificationHost() {
  return <Toaster richColors position="bottom-right" />;
}
