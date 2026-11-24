// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { ipc, rendererLogger } from './ipc-client';

const invoke = vi.fn();

beforeEach(() => {
  invoke.mockReset();
  window.electron = { ipcRenderer: { invoke, on: vi.fn(), sendMessage: vi.fn() } };
});

test('throws a named error for invalid payloads', async () => {
  // Arrange
  invoke.mockResolvedValue({ success: false, error: { name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' } });

  // Act
  const result = ipc.invoke('feeds:list', { workspaceId: NaN });

  // Assert
  await expect(result).rejects.toMatchObject({ name: 'INVALID_PAYLOAD', message: 'Invalid request payload.' });
});

test('keeps the incident ID on unexpected errors and shows its first 8 characters in the message', async () => {
  // Arrange
  invoke.mockResolvedValue({ success: false, error: { name: 'UNEXPECTED_ERROR', message: 'The operation could not be completed.', incidentId: '12345678-abcd' } });

  // Act
  const result = ipc.invoke('feeds:list', { workspaceId: 1 });

  // Assert
  await expect(result).rejects.toMatchObject({ name: 'UNEXPECTED_ERROR', incidentId: '12345678-abcd', message: 'The operation could not be completed. Incident 12345678.' });
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

  test('sends the stack of an Error, which starts with its name and message', () => {
    // Arrange
    const error = new Error('disk full');
    error.stack = 'Error: disk full\n    at save (index.js:1:2)';

    // Act
    rendererLogger.error('renderer.failure', { message: 'Could not save' }, error);

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', { level: 'error', event: 'renderer.failure', data: { message: 'Could not save' }, error: 'Error: disk full\n    at save (index.js:1:2)' });
  });

  test('puts the name and message in front of the frames of an Error whose stack does not hold them', () => {
    // Arrange
    const error = Object.assign(new Error(), { name: 'UNEXPECTED_ERROR', message: 'The operation could not be completed. Incident 5afa079c.' });
    error.stack = 'Error\n    at invoke (index.js:1:2)\n    at load (index.js:3:4)';

    // Act
    rendererLogger.error('renderer.failure', { message: 'Could not load' }, error);

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', expect.objectContaining({
      error: 'UNEXPECTED_ERROR: The operation could not be completed. Incident 5afa079c.\n    at invoke (index.js:1:2)\n    at load (index.js:3:4)',
    }));
  });

  test('sends the message of an Error whose stack has no frame and does not hold it', () => {
    // Arrange
    const error = new Error('disk full');
    error.stack = 'Error';

    // Act
    rendererLogger.error('renderer.failure', { message: 'Could not save' }, error);

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', expect.objectContaining({ error: 'disk full' }));
  });

  test('sends the message of an Error that has no stack', () => {
    // Arrange
    const error = new Error('disk full');
    delete error.stack;

    // Act
    rendererLogger.error('renderer.failure', { message: 'Could not save' }, error);

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', expect.objectContaining({ error: 'disk full' }));
  });

  test('cuts a stack that is longer than 4000 characters', () => {
    // Arrange
    const error = new Error('long');
    error.stack = `Error: long\n${'    at frame (index.js:1:2)\n'.repeat(500)}`;

    // Act
    rendererLogger.error('renderer.failure', { message: 'Could not save' }, error);

    // Assert
    expect((sendMessage().mock.calls[0]?.[1] as { error: string }).error).toHaveLength(4000);
  });

  test('sends the text of a value that is not an Error', () => {
    // Act
    rendererLogger.warn('renderer.failure', { message: 'Could not save' }, 'plain text');

    // Assert
    expect(sendMessage()).toHaveBeenCalledWith('log:write', { level: 'warn', event: 'renderer.failure', data: { message: 'Could not save' }, error: 'plain text' });
  });

  test('cuts a text that is longer than 4000 characters', () => {
    // Act
    rendererLogger.warn('renderer.failure', { message: 'Could not save' }, 'x'.repeat(5000));

    // Assert
    expect((sendMessage().mock.calls[0]?.[1] as { error: string }).error).toHaveLength(4000);
  });
});

test('returns the response of a channel without an argument', async () => {
  // Arrange
  invoke.mockResolvedValue([]);

  // Act
  const result = await ipc.invoke('workspaces:list');

  // Assert
  expect(result).toEqual([]);
});

test.each([
  { key: 'refreshOnLaunch', response: false },
  { key: 'refreshInterval', response: 30 },
] as const)('reads the setting $key', async ({ key, response }) => {
  // Arrange
  invoke.mockResolvedValue(response);

  // Act
  const result = await ipc.invoke('settings:get', { key });

  // Assert
  expect(result).toEqual(response);
  expect(invoke).toHaveBeenCalledExactlyOnceWith('settings:get', { key });
});
