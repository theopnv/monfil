// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { randomUUID } from 'node:crypto';

export function createIncidentId(): string {
  return randomUUID();
}

export function shortIncidentId(incidentId: string): string {
  return incidentId.slice(0, 8);
}
