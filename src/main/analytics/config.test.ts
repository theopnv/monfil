// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { getAnalyticsEndpoint } from './config';

const electron = vi.hoisted(() => ({ app: { isPackaged: true } }));
vi.mock(import('electron'), () => electron as never);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('getAnalyticsEndpoint', () => {
  test('is disabled for a packaged build without a key', () => {
    // Act, Assert
    expect(getAnalyticsEndpoint()).toEqual({ name: 'DISABLED', reason: 'NO_KEY' });
  });

  test('is disabled for a build that is not packaged', () => {
    // Arrange
    electron.app.isPackaged = false;

    // Act
    const endpoint = getAnalyticsEndpoint();
    electron.app.isPackaged = true;

    // Assert
    expect(endpoint).toEqual({ name: 'DISABLED', reason: 'DEVELOPMENT' });
  });

  test('is disabled in an end-to-end run, unless a local endpoint is given', () => {
    // Arrange
    vi.stubEnv('E2E_TEST', '1');

    // Act, Assert
    expect(getAnalyticsEndpoint()).toEqual({ name: 'DISABLED', reason: 'E2E' });
    vi.stubEnv('MONFIL_ANALYTICS_ENDPOINT', 'http://127.0.0.1:1/api/v0/events');
    expect(getAnalyticsEndpoint()).toMatchObject({ name: 'ENABLED', url: 'http://127.0.0.1:1/api/v0/events' });
  });
});
