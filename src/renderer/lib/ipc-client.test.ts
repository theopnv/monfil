// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, expect, test, vi } from 'vitest';
import { ipc } from './ipc-client';
import type { TwoWayRendererMainChannels } from '../../shared/channels';

const invoke = vi.fn();

beforeEach(() => {
  invoke.mockReset();
  window.electron = { ipcRenderer: { invoke, on: vi.fn(), once: vi.fn(), sendMessage: vi.fn() } };
});

test('throws a named error for invalid payloads', async () => {
  // Arrange
  invoke.mockResolvedValue({ success: false, error: { name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' } });

  // Act
  const result = ipc.invoke('feeds:list', { workspaceId: NaN });

  // Assert
  await expect(result).rejects.toMatchObject({ name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' });
});

test('keeps the incident ID on unexpected errors', async () => {
  // Arrange
  invoke.mockResolvedValue({ success: false, error: { name: 'UNEXPECTED_ERROR', message: 'The operation could not be completed.', incidentId: '12345678-abcd' } });

  // Act
  const result = ipc.invoke('feeds:list', { workspaceId: 1 });

  // Assert
  await expect(result).rejects.toMatchObject({ name: 'UNEXPECTED_ERROR', incidentId: '12345678-abcd', message: 'The operation could not be completed.' });
});

test('returns domain failures to the caller', async () => {
  // Arrange
  const failure = { success: false, error: { name: 'DUPLICATE_NAME', message: 'Folder exists.' } };
  invoke.mockResolvedValue(failure);

  // Act
  const result = await ipc.invoke('feeds:create-category', { workspaceId: 1, name: 'Tech' });

  // Assert
  expect(result).toEqual(failure);
});

test.each([
  { channel: 'settings:get-refresh-on-launch', response: false },
  { channel: 'settings:get-refresh-interval', response: 30 },
  { channel: 'workspaces:list', response: [] },
] satisfies { channel: TwoWayRendererMainChannels; response: unknown }[])('returns a valid response for $channel', async ({ channel, response }) => {
  // Arrange
  invoke.mockResolvedValue(response);

  // Act
  const result = await ipc.invoke(channel, undefined);

  // Assert
  expect(result).toEqual(response);
});
