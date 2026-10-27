// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { handleAppGetStartupHealth } from './handlers';

const database = vi.hoisted(() => ({
  status: { name: 'OK' } as Record<string, unknown>,
  settle: undefined as ((onFulfilled: () => void, onRejected: (reason: unknown) => void) => void) | undefined,
}));

vi.mock(import('../db/database'), async (importOriginal) => ({
  ...await importOriginal(),
  dbReady: { then: (onFulfilled: () => void, onRejected: (reason: unknown) => void) => database.settle?.(onFulfilled, onRejected) } as unknown as Promise<void>,
  dbStatus: database.status as never,
}));

function setStatus(status: Record<string, unknown>) {
  for (const key of Object.keys(database.status)) {
    Reflect.deleteProperty(database.status, key);
  }
  Object.assign(database.status, status);
}

beforeEach(() => {
  setStatus({ name: 'OK' });
  database.settle = (onFulfilled) => onFulfilled();
});

describe('handleAppGetStartupHealth', () => {
  test('reports OK once the database is ready', async () => {
    // Act
    const health = await handleAppGetStartupHealth();

    // Assert
    expect(health).toEqual({ name: 'OK' });
  });

  test('waits for the database before it reads the status', async () => {
    // Arrange
    let finishStartup: (() => void) | undefined;
    database.settle = (onFulfilled) => {
      finishStartup = onFulfilled;
    };
    const pending = handleAppGetStartupHealth();
    await vi.waitFor(() => expect(finishStartup).toBeDefined());

    // Act
    setStatus({ name: 'RESET', quarantinePath: 'quarantine/monfil.db', incidentId: 'incident-1' });
    finishStartup?.();

    // Assert
    await expect(pending).resolves.toEqual({ name: 'RESET', incidentId: 'incident-1' });
  });

  test('reports a failed start with its incident ID and without the error message', async () => {
    // Arrange
    setStatus({ name: 'FAILED', message: 'no such table: secret', incidentId: 'incident-2' });
    database.settle = (_onFulfilled, onRejected) => onRejected(new Error('no such table: secret'));

    // Act
    const health = await handleAppGetStartupHealth();

    // Assert
    expect(health).toEqual({ name: 'FAILED', incidentId: 'incident-2' });
  });
});
