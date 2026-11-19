// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { ErrorParams } from '../../shared/errors';

/** Reads the params stored next to a feed's last error. A value that does not parse is dropped, so the row still shows its generic text. */
export function parseErrorParams(stored: string | null | undefined): ErrorParams | null {
  if (!stored) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(stored);
    return typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as ErrorParams | null : null;
  } catch {
    return null;
  }
}
