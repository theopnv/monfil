// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

const MAX_INCIDENTS = 50;

const eventIds = new Map<string, string>();
let latestEventId: string | undefined;

/** Links the short incident ID that an error screen shows to the ID of the report that was sent for it. */
export function rememberReportedEvent(incidentId: string | undefined, eventId: string): void {
  latestEventId = eventId;
  if (!incidentId) {
    return;
  }
  eventIds.delete(incidentId);
  eventIds.set(incidentId, eventId);
  if (eventIds.size > MAX_INCIDENTS) {
    const oldest = eventIds.keys().next().value;
    if (oldest !== undefined) {
      eventIds.delete(oldest);
    }
  }
}

/** Finds the report of an incident. Without an ID, or with an unknown one, it gives the latest report of this session. */
export function findReportedEvent(incidentId?: string): string | undefined {
  return (incidentId ? eventIds.get(incidentId) : undefined) ?? latestEventId;
}

export function forgetReportedEvents(): void {
  eventIds.clear();
  latestEventId = undefined;
}
