// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { RootErrorBoundary } from './RootErrorBoundary';

let sendMessage: ReturnType<typeof vi.fn>;

function Broken(): never {
  throw new TypeError('x is not a function');
}

beforeEach(() => {
  sendMessage = vi.fn();
  window.electron = {
    ipcRenderer: { invoke: vi.fn(() => Promise.resolve({ enabled: true })), sendMessage, on: vi.fn() },
  } as unknown as typeof window.electron;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

test('logs the failure with a new incident ID and the stack, and shows that ID with the report form', async () => {
  // Act
  const { getByRole, getByText } = await render(<RootErrorBoundary><Broken /></RootErrorBoundary>);

  // Assert
  await expect.element(getByRole('heading', { name: 'Monfil ran into a problem' })).toBeInTheDocument();
  const logged = sendMessage.mock.calls.find(([channel]) => channel === 'log:write')?.[1] as { event: string; data: { incidentId: string; message: string }; error: string };
  expect(logged.event).toBe('renderer.failure');
  expect(logged.data.incidentId).toMatch(/^[0-9a-f-]{36}$/);
  expect(logged.error).toContain('TypeError: x is not a function');
  await expect.element(getByText(`incident ${logged.data.incidentId.slice(0, 8)}`, { exact: false })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Add details' })).toBeInTheDocument();
});

test('renders its children when nothing fails', async () => {
  // Act
  const { getByText } = await render(<RootErrorBoundary><p>All good</p></RootErrorBoundary>);

  // Assert
  await expect.element(getByText('All good')).toBeInTheDocument();
  expect(sendMessage).not.toHaveBeenCalled();
});
