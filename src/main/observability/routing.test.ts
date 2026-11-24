// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { observeLogs } from '../logging/logger';
import type { LogEventMap, LogEventName, LogLevel } from '../../shared/logging';
import { forgetReportedEvents, findReportedEvent } from './incidents';
import { breadcrumbData, capturesSettled, startErrorRouting, toError, type ErrorReport, type ReportSink } from './routing';

vi.mock(import('../logging/logger'), () => ({ observeLogs: vi.fn() }));

type Emit = (event: LogEventName, data: LogEventMap[LogEventName], level?: LogLevel, error?: unknown) => void;

const INCIDENT = '0a1b2c3d-1111-2222-3333-444455556666';

let emit: Emit;
let stop: () => void;
let sink: ReportSink & { captured: ErrorReport[]; crumbs: Parameters<ReportSink['breadcrumb']>[0][] };
let startingUp: boolean;
let accept: (fingerprint: string) => Promise<boolean>;
let unsubscribe: ReturnType<typeof vi.fn>;

beforeEach(() => {
  startingUp = false;
  accept = () => Promise.resolve(true);
  const captured: ErrorReport[] = [];
  const crumbs: Parameters<ReportSink['breadcrumb']>[0][] = [];
  sink = {
    captured,
    crumbs,
    breadcrumb: (crumb) => crumbs.push(crumb),
    capture: (report) => {
      captured.push(report);
      return `event-${captured.length}`;
    },
  };
  unsubscribe = vi.fn();
  vi.mocked(observeLogs).mockImplementation((observer) => {
    emit = (event, data, level = 'error', error) => observer(event, data, level, error);
    return unsubscribe as () => void;
  });
  stop = startErrorRouting({ sink, caps: { accept: (fingerprint) => accept(fingerprint) }, isStartingUp: () => startingUp });
});

afterEach(() => {
  forgetReportedEvents();
});

async function settle(): Promise<void> {
  await new Promise((resolve) => setImmediate(resolve));
}

describe('failures that go to the error tracker', () => {
  test.each([
    ['system.failure', { source: 'uncaughtException', incidentId: INCIDENT }, { source: 'uncaughtException', incidentId: '0a1b2c3d' }],
    ['renderer.failure', { message: 'Root render failed', incidentId: INCIDENT }, { incidentId: '0a1b2c3d' }],
    ['ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT, setting: 'language' }, { channel: 'feeds:list', incidentId: '0a1b2c3d' }],
    ['database.recovery', { outcome: 'failed', incidentId: INCIDENT }, { outcome: 'failed', incidentId: '0a1b2c3d' }],
    ['database.recovery', { outcome: 'reset' }, { outcome: 'reset' }],
    ['framework.fallback', { requestedSurface: 'tray', errorName: 'TypeError' }, { requestedSurface: 'tray', errorName: 'TypeError' }],
    ['app.update', { outcome: 'failed' }, { outcome: 'failed' }],
    ['feed.refresh', { outcome: 'failed', errorCode: 'UNKNOWN_ERROR' }, { errorName: 'UNKNOWN_ERROR' }],
    ['feed.refresh', { outcome: 'failed' }, {}],
  ] as const)('sends %j with its tags', async (event, data, tags) => {
    // Act
    emit(event, data, 'error', new Error('boom'));
    await settle();

    // Assert
    expect(sink.captured).toHaveLength(1);
    expect(sink.captured[0]?.tags).toEqual({ logEvent: event, ...tags });
    expect(sink.captured[0]?.error?.message).toBe('boom');
  });

  test.each([
    ['app.update', { outcome: 'ready' }],
    ['app.lifecycle', { action: 'start' }],
    ['app.analytics', { outcome: 'failed', events: 1 }],
    ['operation.failure', { operation: 'extract-article', entityId: 9 }],
    ['feed.refresh', { outcome: 'failed', feedId: 3, errorCode: 'NETWORK_ERROR' }],
    ['feed.refresh', { outcome: 'failed', feedId: 3, errorCode: 'GENERIC_FETCH_ERROR' }],
    ['feed.refresh', { outcome: 'failed', feedId: 3, errorCode: 'PARSE_ERROR' }],
    ['feed.refresh', { outcome: 'failed', errorCode: 'RESPONSE_TOO_LARGE_ERROR' }],
  ] as const)('does not send %s %j', async (event, data) => {
    // Act
    emit(event, data, 'warn', new Error('boom'));
    await settle();

    // Assert
    expect(sink.captured).toEqual([]);
  });

  test('sends a failure without an error as a message that groups by its enum fields', async () => {
    // Act
    emit('database.recovery', { outcome: 'reset' }, 'warn');
    await settle();

    // Assert
    expect(sink.captured[0]).toMatchObject({ error: undefined, message: 'database.recovery', level: 'warning', fingerprint: ['database.recovery', 'reset'] });
  });

  test('does not put a renderer message or an incident ID in a fingerprint', async () => {
    // Act
    emit('renderer.failure', { message: 'Error loading the language setting:', incidentId: INCIDENT });
    await settle();

    // Assert
    expect(sink.captured[0]?.fingerprint).toEqual(['renderer.failure']);
  });

  test.each([['crashed'], ['oom'], ['launch-failed']])('tags a process that went away with the reason %s', async (reason) => {
    // Act
    emit('system.failure', { source: 'render-process-gone', incidentId: INCIDENT }, 'error', { reason, exitCode: 9, name: 'secret service' });
    await settle();

    // Assert
    expect(sink.captured[0]?.tags).toEqual({ logEvent: 'system.failure', source: 'render-process-gone', incidentId: '0a1b2c3d', reason });
    expect(sink.captured[0]).toMatchObject({ error: undefined, handled: false, fingerprint: ['system.failure', 'render-process-gone', reason] });
  });

  test('drops a reason that Electron does not document', async () => {
    // Act
    emit('system.failure', { source: 'child-process-gone', incidentId: INCIDENT }, 'error', { reason: 'https://x.test/a' });
    await settle();

    // Assert
    expect(sink.captured[0]?.tags['reason']).toBeUndefined();
  });

  test('marks a system failure as unhandled and a failed request as handled', async () => {
    // Act
    emit('system.failure', { source: 'uncaughtException', incidentId: INCIDENT }, 'error', new Error('a'));
    emit('ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT }, 'error', new Error('b'));
    await settle();

    // Assert
    expect(sink.captured.map((report) => report.handled)).toEqual([false, true]);
  });

  test('marks a failure that happens before the first river render', async () => {
    // Arrange
    startingUp = true;

    // Act
    emit('system.failure', { source: 'render-process-gone', incidentId: INCIDENT });
    await settle();

    // Assert
    expect(sink.captured[0]?.tags['startup']).toBe('true');
  });

  test('does not send an event that the caps refuse, and asks with a fingerprint of the failure', async () => {
    // Arrange
    const asked: string[] = [];
    accept = (fingerprint) => {
      asked.push(fingerprint);
      return Promise.resolve(false);
    };

    // Act
    const error = new TypeError('x');
    error.stack = 'TypeError: x';
    emit('ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT }, 'error', error);
    await settle();

    // Assert
    expect(sink.captured).toEqual([]);
    expect(asked).toEqual(['ipc.failure|feeds:list|TypeError|']);
  });

  test('tells two stack traces apart in the caps fingerprint', async () => {
    // Arrange
    const asked: string[] = [];
    accept = (fingerprint) => {
      asked.push(fingerprint);
      return Promise.resolve(true);
    };
    const first = new Error('a');
    first.stack = 'Error: a\n    at readFeed (/app/main.cjs:10:5)';
    const second = new Error('a');
    second.stack = 'Error: a\n    at writeFeed (/app/main.cjs:20:5)';
    const third = new Error('a');
    third.stack = 'Error: a\n    at /app/main.cjs:30:5';

    // Act
    emit('system.failure', { source: 'x', incidentId: INCIDENT }, 'error', first);
    emit('system.failure', { source: 'x', incidentId: INCIDENT }, 'error', second);
    emit('system.failure', { source: 'x', incidentId: INCIDENT }, 'error', third);
    await settle();

    // Assert
    expect(asked).toEqual(['system.failure|x|Error|readFeed', 'system.failure|x|Error|writeFeed', 'system.failure|x|Error|main.cjs']);
  });

  test('links the incident ID to the event that was sent', async () => {
    // Act
    emit('ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT }, 'error', new Error('x'));
    await settle();

    // Assert
    expect(findReportedEvent('0a1b2c3d')).toBe('event-1');
  });

  test('stops observing the logs when it is stopped', () => {
    // Act
    stop();

    // Assert
    expect(unsubscribe).toHaveBeenCalledOnce();
  });
});

describe('capturesSettled', () => {
  test('waits until a failure that is being counted by the caps has reached the tracker', async () => {
    // Arrange
    let release: (accepted: boolean) => void = () => undefined;
    accept = () => new Promise<boolean>((resolve) => {
      release = resolve;
    });
    emit('ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT }, 'error', new Error('x'));
    let settled = false;
    const waiting = capturesSettled().then(() => {
      settled = true;
    });
    await settle();

    // Act, Assert
    expect(settled).toBe(false);
    expect(sink.captured).toEqual([]);
    release(true);
    await waiting;
    expect(settled).toBe(true);
    expect(sink.captured).toHaveLength(1);
  });

  test('settles at once when nothing is pending, and after a refusal', async () => {
    // Arrange
    accept = () => Promise.resolve(false);
    emit('ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT }, 'error', new Error('x'));

    // Act, Assert
    await expect(capturesSettled()).resolves.toBeUndefined();
    await expect(capturesSettled()).resolves.toBeUndefined();
  });

  test('does not reject when the tracker throws', async () => {
    // Arrange
    sink.capture = () => {
      throw new Error('sdk failed');
    };
    emit('ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT }, 'error', new Error('x'));

    // Act, Assert
    await expect(capturesSettled()).resolves.toBeUndefined();
  });
});

describe('breadcrumbs', () => {
  test('keeps a trail of the other records with enum fields only', () => {
    // Act
    emit('app.lifecycle', { action: 'window-created' }, 'info');
    emit('operation.failure', { operation: 'extract-article', entityId: 4 }, 'warn');
    emit('app.analytics', { outcome: 'sent', events: 3, status: 200 }, 'info');

    // Assert
    expect(sink.crumbs).toEqual([
      { event: 'app.lifecycle', level: 'info', data: { action: 'window-created' } },
      { event: 'operation.failure', level: 'warn', data: { operation: 'extract-article' } },
      { event: 'app.analytics', level: 'info', data: { outcome: 'sent' } },
    ]);
  });

  test('skips debug records', () => {
    // Act
    emit('app.lifecycle', { action: 'tick' }, 'debug');

    // Assert
    expect(sink.crumbs).toEqual([]);
  });

  test.each([
    ['feed.refresh', { outcome: 'failed', feedId: 3, errorCode: 'NETWORK_ERROR' }, { outcome: 'failed', errorCode: 'NETWORK_ERROR' }],
    ['feed.refresh', { outcome: 'failed', feedId: 3 }, { outcome: 'failed' }],
    ['ipc.failure', { channel: 'feeds:list', incidentId: INCIDENT, setting: 'language' }, { channel: 'feeds:list' }],
    ['system.failure', { source: 'uncaughtException', incidentId: INCIDENT }, { source: 'uncaughtException' }],
    ['framework.fallback', { requestedSurface: 'tray', errorName: 'TypeError' }, { requestedSurface: 'tray', errorName: 'TypeError' }],
    ['database.recovery', { outcome: 'reset', incidentId: INCIDENT }, { outcome: 'reset' }],
    ['app.update', { outcome: 'failed' }, { outcome: 'failed' }],
    ['renderer.failure', { message: 'text that may hold anything' }, {}],
  ] as const)('reduces %s to %j', (event, data, expected) => {
    // Act, Assert
    expect(breadcrumbData(event, data)).toEqual(expected);
  });
});

describe('toError', () => {
  test('keeps an Error as it is', () => {
    // Arrange
    const error = new RangeError('x');

    // Act, Assert
    expect(toError(error)).toBe(error);
  });

  test('rebuilds an error that a renderer sent as text, with its stack', () => {
    // Act
    const error = toError('TypeError: x is not a function\n    at render (index.js:1:2)');

    // Assert
    expect(error).toMatchObject({ name: 'TypeError', message: 'x is not a function' });
    expect(error?.stack).toBe('TypeError: x is not a function\n    at render (index.js:1:2)');
  });

  test('reads text that has no name', () => {
    // Act
    const error = toError('something failed');

    // Assert
    expect(error).toMatchObject({ name: 'Error', message: 'something failed' });
  });

  test('turns a coded error into an Error with that name', () => {
    // Act
    const error = toError({ name: 'UNKNOWN_ERROR', message: 'bad', params: { a: 1 } });

    // Assert
    expect(error).toMatchObject({ name: 'UNKNOWN_ERROR', message: 'bad' });
  });

  test.each([[undefined], [''], [42], [{}], [null]])('gives nothing for %j', (value) => {
    // Act, Assert
    expect(toError(value)).toBeUndefined();
  });
});
