// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { randomUUID } from 'node:crypto';
import os from 'node:os';
import { app, net } from 'electron';
import type { DailySummaryProps } from '../../shared/contracts';
import type { AnalyticsEndpoint } from './endpoint';

/** The server accepts at most 25 events per request. */
export const MAX_EVENTS_PER_REQUEST = 25;

const REQUEST_TIMEOUT_MS = 15_000;

export interface AnalyticsEvent {
  timestamp: string;
  eventName: string;
  props?: DailySummaryProps;
}

export type SendOutcome = { ok: true } | { ok: false; status?: number };

function systemProps() {
  return {
    sdkVersion: `monfil@${app.getVersion()}`,
    appVersion: app.getVersion(),
    osName: process.platform,
    osVersion: os.release(),
    locale: app.getLocale(),
    engineName: 'Chromium',
    engineVersion: process.versions.chrome,
    isDebug: !app.isPackaged,
  };
}

/**
 * Posts events to the analytics server in requests of at most 25 events. Each request gets a new random session id,
 * so no identifier ties one request to another.
 * @param endpoint where to post
 * @param events the events to post
 * @returns `ok` once every request got a 2xx answer, or the status of the first one that did not
 */
export async function sendEvents(endpoint: Extract<AnalyticsEndpoint, { name: 'ENABLED' }>, events: readonly AnalyticsEvent[]): Promise<SendOutcome> {
  for (let start = 0; start < events.length; start += MAX_EVENTS_PER_REQUEST) {
    const sessionId = randomUUID();
    const body = events.slice(start, start + MAX_EVENTS_PER_REQUEST).map((event) => ({ ...event, sessionId, systemProps: systemProps() }));
    try {
      const response = await net.fetch(endpoint.url, {
        method: 'POST',
        headers: { 'App-Key': endpoint.key, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
      if (!response.ok) {
        return { ok: false, status: response.status };
      }
    } catch {
      return { ok: false };
    }
  }
  return { ok: true };
}
