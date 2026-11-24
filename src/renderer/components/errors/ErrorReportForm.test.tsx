// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ErrorReportForm } from './ErrorReportForm';

let invoke: ReturnType<typeof vi.fn>;
let enabled: boolean;
let submitResult: unknown;
let log: { text: string; truncated: boolean };

beforeEach(() => {
  enabled = true;
  submitResult = { success: true, data: undefined };
  log = { text: '{"event":"app.lifecycle"}\n', truncated: false };
  invoke = vi.fn((channel: string) => {
    switch (channel) {
      case 'report:get-state': return Promise.resolve({ enabled });
      case 'report:preview-log': return Promise.resolve(log);
      case 'report:submit': return Promise.resolve(submitResult);
      default: return Promise.resolve(undefined);
    }
  });
  window.electron = { ipcRenderer: { invoke, sendMessage: vi.fn(), on: vi.fn() } } as unknown as typeof window.electron;
});

test('shows nothing while error reports are off', async () => {
  // Arrange
  enabled = false;

  // Act
  const { container } = await render(<ErrorReportForm incidentId="abcd1234" />);

  // Assert
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('report:get-state', undefined));
  expect(container.textContent).toBe('');
});

test('shows nothing when the main process does not answer', async () => {
  // Arrange
  window.electron = { ipcRenderer: { invoke: vi.fn(() => Promise.reject(new Error('gone'))), sendMessage: vi.fn(), on: vi.fn() } } as unknown as typeof window.electron;

  // Act
  const { container } = await render(<ErrorReportForm />);

  // Assert
  await vi.waitFor(() => expect(window.electron.ipcRenderer.invoke).toHaveBeenCalled());
  expect(container.textContent).toBe('');
});

test('offers to add details, and opens the form with the log box unticked', async () => {
  // Arrange
  const { getByRole, getByLabelText } = await render(<ErrorReportForm incidentId="abcd1234" />);

  // Act
  await getByRole('button', { name: 'Add details' }).click();

  // Assert
  await expect.element(getByLabelText('What were you doing? (optional)')).toBeInTheDocument();
  await expect.element(getByRole('checkbox', { name: 'Attach the log file' })).not.toBeChecked();
});

test('sends the comment and the incident without the log by default', async () => {
  // Arrange
  const { getByRole, getByLabelText } = await render(<ErrorReportForm incidentId="abcd1234" />);
  await getByRole('button', { name: 'Add details' }).click();

  // Act
  await getByLabelText('What were you doing? (optional)').fill('I opened settings');
  await getByRole('button', { name: 'Send' }).click();

  // Assert
  expect(invoke).toHaveBeenCalledWith('report:submit', { incidentId: 'abcd1234', comment: 'I opened settings', attachLog: false });
  await expect.element(getByRole('status')).toHaveTextContent('Thank you. Your details were sent.');
});

test('sends the log when the user ticks the box', async () => {
  // Arrange
  const { getByRole } = await render(<ErrorReportForm incidentId="abcd1234" />);
  await getByRole('button', { name: 'Add details' }).click();

  // Act
  await getByRole('checkbox', { name: 'Attach the log file' }).click();
  await getByRole('button', { name: 'Send' }).click();

  // Assert
  expect(invoke).toHaveBeenCalledWith('report:submit', { incidentId: 'abcd1234', comment: '', attachLog: true });
});

test('shows the log that would be attached, and loads it only when asked', async () => {
  // Arrange
  const { getByRole, getByLabelText } = await render(<ErrorReportForm />);
  await getByRole('button', { name: 'Add details' }).click();
  expect(invoke).not.toHaveBeenCalledWith('report:preview-log', undefined);

  // Act
  await getByRole('button', { name: 'Preview the log file' }).click();

  // Assert
  await vi.waitFor(() => expect(getByLabelText('Log file preview').element().textContent).toContain('app.lifecycle'));
  await getByRole('button', { name: 'Hide the preview' }).click();
  await expect.element(getByLabelText('Log file preview')).not.toBeInTheDocument();
});

test('says when the log is empty or cut', async () => {
  // Arrange
  log = { text: '', truncated: true };
  const { getByRole, getByText } = await render(<ErrorReportForm />);
  await getByRole('button', { name: 'Add details' }).click();

  // Act
  await getByRole('button', { name: 'Preview the log file' }).click();

  // Assert
  await expect.element(getByText('The log file is empty.')).toBeInTheDocument();
  await expect.element(getByText('Only the last 1 MB of the log file is attached.')).toBeInTheDocument();
});

test.each([
  ['a refusal', { success: false, error: { name: 'REPORTS_OFF', message: 'off' } }],
  ['an IPC failure', { success: false, error: { name: 'UNEXPECTED_ERROR', message: 'x', incidentId: 'abcdef12-0000' } }],
])('shows an error and keeps the form after %s', async (_label, result) => {
  // Arrange
  submitResult = result;
  const { getByRole } = await render(<ErrorReportForm incidentId="abcd1234" />);
  await getByRole('button', { name: 'Add details' }).click();

  // Act
  await getByRole('button', { name: 'Send' }).click();

  // Assert
  await expect.element(getByRole('alert')).toHaveTextContent('The details could not be sent. Try again later.');
  await expect.element(getByRole('button', { name: 'Send' })).toBeEnabled();
});

test('closes the form without sending when the user cancels', async () => {
  // Arrange
  const { getByRole } = await render(<ErrorReportForm />);
  await getByRole('button', { name: 'Add details' }).click();

  // Act
  await getByRole('button', { name: 'Cancel' }).click();

  // Assert
  await expect.element(getByRole('button', { name: 'Add details' })).toBeInTheDocument();
  expect(invoke).not.toHaveBeenCalledWith('report:submit', expect.anything());
});
