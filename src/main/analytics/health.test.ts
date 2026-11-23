// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { observeLogs } from '../logging/logger';
import { incrementCounter } from './counters';
import { startHealthCounters } from './health';
import type { LogEventMap, LogEventName } from '../../shared/logging';

vi.mock(import('../logging/logger'), () => ({ observeLogs: vi.fn() }));
vi.mock(import('./counters'), () => ({ incrementCounter: vi.fn() }));

let emit: (event: LogEventName, data: LogEventMap[LogEventName], error?: unknown) => void;

beforeEach(() => {
  vi.mocked(observeLogs).mockImplementation((observer) => {
    emit = (event, data, error) => observer(event, data, 'error', error);
    return () => undefined;
  });
  startHealthCounters();
});

describe('health counters', () => {
  test.each([
    ['feed.refresh', { outcome: 'failed' }, 'refresh_failures'],
    ['operation.failure', { operation: 'extract-article', entityId: 4 }, 'extraction_failures'],
    ['ipc.failure', { channel: 'feeds:list', incidentId: 'x' }, 'ipc_failures'],
    ['renderer.failure', { message: 'broken' }, 'renderer_failures'],
  ] as const)('%s counts %s', (event, data, counter) => {
    // Act
    emit(event, data);

    // Assert
    expect(incrementCounter).toHaveBeenCalledExactlyOnceWith(counter);
  });

  test('a failed refresh counts its error bucket too', () => {
    // Act
    emit('feed.refresh', { outcome: 'failed', errorCode: 'GENERIC_FETCH_ERROR' }, { name: 'GENERIC_FETCH_ERROR', message: 'HTTP 503', params: { status: 503 } });

    // Assert
    expect(vi.mocked(incrementCounter).mock.calls.map(([name]) => name)).toEqual(['refresh_failures', 'refresh_error_http_5xx']);
  });

  test.each([
    ['operation.failure', { operation: 'usage-counter' }],
    ['app.lifecycle', { action: 'start' }],
    ['system.failure', { source: 'x', incidentId: 'y' }],
  ] as const)('%s counts nothing', (event, data) => {
    // Act
    emit(event, data);

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });
});
