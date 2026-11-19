// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';

const SHORTCUTS = [
  { key: "J", description: "next" },
  { key: "K", description: "previous" },
  { key: "Esc", description: "back" },
] as const;

export default function KeyboardShortcutsHint() {
  const { t } = useTranslation('reader');
  return (
    <div className="mb-8.5 flex items-center justify-center gap-4 text-sm text-tertiary">
      {SHORTCUTS.map(({ key, description }) => (
        <span key={key} className="flex items-center gap-1.5">
          <kbd className="rounded-md border border-secondary px-1.5 py-0.5 font-mono text-xs text-secondary">{key}</kbd>
          <span>{t(`shortcuts.${description}`)}</span>
        </span>
      ))}
    </div>
  );
}
