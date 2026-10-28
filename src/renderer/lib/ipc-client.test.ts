// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ipc, rendererLogger } from './ipc-client';
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
  { label: 'a success response that carries an error field', response: { success: true, error: { name: 'INVALID_PAYLOAD', message: 'Not a failure.' } } },
  { label: 'a failure of another kind that carries an incident ID', response: { success: false, error: { name: 'DB_ERROR', message: 'Disk full.', incidentId: '12345678-abcd' } } },
  { label: 'an unexpected error without a message', response: { success: false, error: { name: 'UNEXPECTED_ERROR', incidentId: '12345678-abcd' } } },
  { label: 'an unexpected error without an incident ID', response: { success: false, error: { name: 'UNEXPECTED_ERROR', message: 'The operation could not be completed.' } } },
  { label: 'an invalid payload error without a message', response: { success: false, error: { name: 'INVALID_PAYLOAD' } } },
])('returns $label to the caller', async ({ response }) => {
  // Arrange
  invoke.mockResolvedValue(response);

  // Act
  const result = await ipc.invoke('feeds:list', { workspaceId: 1 });

  // Assert
  expect(result).toEqual(response);
});

describe('rendererLogger', () => {
  const sendMessage = () => vi.mocked(window.electron.ipcRenderer.sendMessage);

  test('sends an entry without an error field when no error is given', () => {
    // Act
    rendererLogger.info('renderer.failure', { message: 'Something happened' });

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', { level: 'info', event: 'renderer.failure', data: { message: 'Something happened' } });
    expect(Object.keys(sendMessage().mock.calls[0]?.[1] as object)).not.toContain('error');
  });

  test('sends the message of an Error', () => {
    // Act
    rendererLogger.error('renderer.failure', { message: 'Could not save' }, new Error('disk full'));

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', { level: 'error', event: 'renderer.failure', data: { message: 'Could not save' }, error: 'disk full' });
  });

  test('sends the text of a value that is not an Error', () => {
    // Act
    rendererLogger.warn('renderer.failure', { message: 'Could not save' }, 'plain text');

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', { level: 'warn', event: 'renderer.failure', data: { message: 'Could not save' }, error: 'plain text' });
  });
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
