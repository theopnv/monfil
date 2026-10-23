// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { net } from 'electron';
import { MAX_EVENTS_PER_REQUEST, sendEvents, type AnalyticsEvent } from './client';

vi.mock(import('electron'), () => ({
  app: { getVersion: () => '1.2.3', getLocale: () => 'en-US', isPackaged: true } as unknown as Electron.App,
  net: { fetch: vi.fn() } as unknown as typeof net,
}));

const endpoint = { name: 'ENABLED' as const, url: 'https://eu.aptabase.com/api/v0/events', key: 'A-EU-1' };
const event = (index: number): AnalyticsEvent => ({ timestamp: '2026-10-22T10:00:00.000Z', eventName: 'daily_summary', props: { day: `d${index}` } });

beforeEach(() => {
  Object.defineProperty(process.versions, 'chrome', { value: '130.0.0', configurable: true });
  vi.mocked(net.fetch).mockResolvedValue(new Response(null, { status: 200 }));
});

function bodies(): { sessionId: string; eventName: string; systemProps: Record<string, unknown> }[][] {
  return vi.mocked(net.fetch).mock.calls.map(([, init]) => JSON.parse(String(init?.body)));
}

describe('sendEvents', () => {
  test('posts the events with the app key and the system props', async () => {
    // Act
    const outcome = await sendEvents(endpoint, [event(1)]);

    // Assert
    expect(outcome).toEqual({ ok: true });
    const [url, init] = vi.mocked(net.fetch).mock.calls[0] ?? [];
    expect(url).toBe(endpoint.url);
    expect(init?.method).toBe('POST');
    expect(init?.headers).toEqual({ 'App-Key': 'A-EU-1', 'Content-Type': 'application/json' });
    expect(bodies()[0]?.[0]).toMatchObject({
      eventName: 'daily_summary',
      systemProps: { sdkVersion: 'monfil@1.2.3', appVersion: '1.2.3', osName: process.platform, locale: 'en-US', engineName: 'Chromium', engineVersion: '130.0.0', isDebug: false },
    });
  });

  test('splits 26 events into requests of 25 and 1, each with its own session id', async () => {
    // Act
    await sendEvents(endpoint, Array.from({ length: MAX_EVENTS_PER_REQUEST + 1 }, (_, index) => event(index)));

    // Assert
    const sent = bodies();
    expect(sent.map((batch) => batch.length)).toEqual([25, 1]);
    expect(new Set(sent[0]?.map((item) => item.sessionId)).size).toBe(1);
    expect(sent[0]?.[0]?.sessionId).not.toBe(sent[1]?.[0]?.sessionId);
    expect(sent[0]?.[0]?.sessionId.length).toBeLessThanOrEqual(36);
  });

  test('sends nothing for no events', async () => {
    // Act, Assert
    await expect(sendEvents(endpoint, [])).resolves.toEqual({ ok: true });
    expect(net.fetch).not.toHaveBeenCalled();
  });

  test('stops at the first answer that is not a 2xx', async () => {
    // Arrange
    vi.mocked(net.fetch).mockResolvedValue(new Response(null, { status: 400 }));

    // Act
    const outcome = await sendEvents(endpoint, Array.from({ length: 30 }, (_, index) => event(index)));

    // Assert
    expect(outcome).toEqual({ ok: false, status: 400 });
    expect(net.fetch).toHaveBeenCalledOnce();
  });

  test('reports a network failure without a status', async () => {
    // Arrange
    vi.mocked(net.fetch).mockRejectedValue(new Error('offline'));

    // Act, Assert
    await expect(sendEvents(endpoint, [event(1)])).resolves.toEqual({ ok: false });
  });
});
