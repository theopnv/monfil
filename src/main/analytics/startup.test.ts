// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { observeLogs } from '../logging/logger';
import { incrementCounter } from './counters';
import { isStartingUp } from '../app/startup-state';
import { recordStartupComplete, recordStartupFailure, resetStartupForTest, startStartupHealth, startupTimeCounter } from './startup';
import type { LogEventMap, LogEventName, LogLevel } from '../../shared/logging';

vi.mock(import('../logging/logger'), () => ({ observeLogs: vi.fn() }));
vi.mock(import('./counters'), () => ({ incrementCounter: vi.fn() }));

const counted = () => vi.mocked(incrementCounter).mock.calls.map(([name]) => name);

function provideCreationTime(value: number | null): void {
  Object.defineProperty(process, 'getCreationTime', { value: () => value, configurable: true });
}

afterEach(() => {
  resetStartupForTest();
  Reflect.deleteProperty(process, 'getCreationTime');
});

describe('startupTimeCounter', () => {
  test.each([
    [0, 'startup_time_lt_1s'],
    [999, 'startup_time_lt_1s'],
    [1000, 'startup_time_1_3s'],
    [2999, 'startup_time_1_3s'],
    [3000, 'startup_time_3_10s'],
    [9999, 'startup_time_3_10s'],
    [10_000, 'startup_time_gt_10s'],
    [120_000, 'startup_time_gt_10s'],
  ])('puts %d ms in %s', (milliseconds, counter) => {
    // Act, Assert
    expect(startupTimeCounter(milliseconds)).toBe(counter);
  });
});

describe('recordStartupComplete', () => {
  test('counts one success and the time bucket since the process was created', () => {
    // Arrange
    const now = new Date('2026-11-23T08:00:02Z');
    provideCreationTime(now.getTime() - 1500);

    // Act
    recordStartupComplete(now);
    recordStartupComplete(now);

    // Assert
    expect(counted()).toEqual(['startup_ok', 'startup_time_1_3s']);
    expect(isStartingUp()).toBe(false);
  });

  test.each([['has no creation time', undefined], ['cannot read its creation time', null]])('uses the load time of the module when the process %s', (_label, value) => {
    // Arrange
    if (value === null) {
      provideCreationTime(null);
    }

    // Act
    recordStartupComplete(new Date());

    // Assert
    expect(counted()).toEqual(['startup_ok', 'startup_time_lt_1s']);
  });

  test('counts no success after a failure of the same run', () => {
    // Arrange
    recordStartupFailure();

    // Act
    recordStartupComplete();

    // Assert
    expect(counted()).toEqual(['startup_failed']);
    expect(isStartingUp()).toBe(false);
  });
});

describe('recordStartupFailure', () => {
  test('counts one failure, and none once the startup is complete', () => {
    // Act
    recordStartupFailure();
    recordStartupFailure();

    // Assert
    expect(counted()).toEqual(['startup_failed']);
    expect(isStartingUp()).toBe(true);
  });

  test('counts nothing after the first river render', () => {
    // Arrange
    recordStartupComplete();
    vi.mocked(incrementCounter).mockClear();

    // Act
    recordStartupFailure();

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });
});

describe('startStartupHealth', () => {
  let emit: (event: LogEventName, data: LogEventMap[LogEventName], level: LogLevel) => void;

  beforeEach(() => {
    vi.mocked(observeLogs).mockImplementation((observer) => {
      emit = (event, data, level) => observer(event, data, level, undefined);
      return () => undefined;
    });
    startStartupHealth();
  });

  test.each([
    ['system.failure', { source: 'x', incidentId: 'y' }],
    ['ipc.failure', { channel: 'app:get-startup-health', incidentId: 'y' }],
    ['renderer.failure', { message: 'Root render failed' }],
    ['database.recovery', { outcome: 'failed' }],
  ] as const)('%s at error level fails the startup', (event, data) => {
    // Act
    emit(event, data, 'error');

    // Assert
    expect(counted()).toEqual(['startup_failed']);
  });

  test.each([
    ['database.recovery', { outcome: 'reset' }, 'error'],
    ['renderer.failure', { message: 'Hints check failed' }, 'warn'],
    ['feed.refresh', { outcome: 'failed' }, 'error'],
    ['app.lifecycle', { action: 'x' }, 'info'],
  ] as const)('%s at the %s level does not', (event, data, level) => {
    // Act
    emit(event, data, level);

    // Assert
    expect(incrementCounter).not.toHaveBeenCalled();
  });
});
