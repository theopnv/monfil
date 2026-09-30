// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export type WindowTheme = 'light' | 'dark';

export function titleBarOverlayForTheme(theme: WindowTheme) {
  return theme === 'dark'
    ? { color: '#272019', symbolColor: '#f2e7d6', height: 32 }
    : { color: '#ebddc5', symbolColor: '#201e1d', height: 32 };
}
