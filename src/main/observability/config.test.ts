// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { app } from 'electron';
import { getSentryEndpoint } from './config';

const electron = vi.hoisted(() => ({ app: { isPackaged: true } }));

vi.mock(import('electron'), () => electron as never);

afterEach(() => {
  vi.unstubAllEnvs();
  electron.app.isPackaged = true;
});

describe('getSentryEndpoint', () => {
  test('sends nothing from a build without a DSN', () => {
    // Act, Assert
    expect(getSentryEndpoint()).toEqual({ name: 'DISABLED', reason: 'NO_DSN' });
  });

  test('sends nothing from an unpackaged app', () => {
    // Arrange
    electron.app.isPackaged = false;

    // Act, Assert
    expect(app.isPackaged).toBe(false);
    expect(getSentryEndpoint()).toEqual({ name: 'DISABLED', reason: 'DEVELOPMENT' });
  });

  test('reads the stub of an end-to-end run from the environment', () => {
    // Arrange
    vi.stubEnv('E2E_TEST', '1');
    vi.stubEnv('MONFIL_SENTRY_ENDPOINT', 'http://key@127.0.0.1:4000/1');

    // Act, Assert
    expect(getSentryEndpoint()).toEqual({ name: 'ENABLED', dsn: 'http://key@127.0.0.1:4000/1' });
  });

  test('ignores the stub when E2E_TEST is not 1', () => {
    // Arrange
    vi.stubEnv('E2E_TEST', '0');
    vi.stubEnv('MONFIL_SENTRY_ENDPOINT', 'http://key@127.0.0.1:4000/1');

    // Act, Assert
    expect(getSentryEndpoint()).toEqual({ name: 'DISABLED', reason: 'NO_DSN' });
  });
});
