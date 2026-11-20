// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export function readLocalStorageJSON(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) {
    return undefined;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
}

export function writeLocalStorageJSON(key: string, value: unknown): void {
  localStorage.setItem(key, JSON.stringify(value));
}
