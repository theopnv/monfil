import { randomUUID } from 'node:crypto';

export function createIncidentId(): string {
  return randomUUID();
}

export function shortIncidentId(incidentId: string): string {
  return incidentId.slice(0, 8);
}
