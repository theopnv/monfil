// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import { recordUsage, useUsageAnalytics } from './usage';
import type { UsageAnalyticsState } from '../../shared/contracts';

const initial: UsageAnalyticsState = { consent: 'unset', shouldPrompt: true, available: true };

let invokeMock: ReturnType<typeof vi.fn>;
let sendMock: ReturnType<typeof vi.fn>;

function Probe() {
  const { state, choose, dismiss } = useUsageAnalytics();
  return (
    <div>
      <span data-testid="consent">{state?.consent}</span>
      <span data-testid="prompt">{String(state?.shouldPrompt)}</span>
      <button onClick={() => choose('granted')}>Allow</button>
      <button onClick={() => dismiss()}>Dismiss</button>
    </div>
  );
}

beforeEach(() => {
  invokeMock = vi.fn((channel: string) => Promise.resolve(channel === 'settings:get-usage-analytics' ? initial : undefined));
  sendMock = vi.fn();
  window.electron = {
    ipcRenderer: { invoke: invokeMock, on: vi.fn(() => vi.fn()), once: vi.fn(), sendMessage: sendMock },
  } as unknown as typeof window.electron;
});

describe('recordUsage', () => {
  test('sends the counter to the main process', () => {
    // Act
    recordUsage('searches');

    // Assert
    expect(sendMock).toHaveBeenCalledWith('usage:record', { counter: 'searches' });
  });
});

describe('useUsageAnalytics', () => {
  test('shows the stored choice after the user allows usage stats', async () => {
    // Arrange
    await renderWithQueryClient(<Probe />);
    await expect.element(page.getByTestId('consent')).toHaveTextContent('unset');
    invokeMock.mockImplementation((channel: string) => Promise.resolve(
      channel === 'settings:set-usage-analytics' ? { consent: 'granted', shouldPrompt: false, available: true } : initial,
    ));

    // Act
    await page.getByRole('button', { name: 'Allow' }).click();

    // Assert
    expect(invokeMock).toHaveBeenCalledWith('settings:set-usage-analytics', 'granted');
    await expect.element(page.getByTestId('consent')).toHaveTextContent('granted');
  });

  test('stops asking after the user dismisses the prompt', async () => {
    // Arrange
    await renderWithQueryClient(<Probe />);
    await expect.element(page.getByTestId('prompt')).toHaveTextContent('true');
    invokeMock.mockImplementation((channel: string) => Promise.resolve(
      channel === 'settings:dismiss-usage-analytics-prompt' ? { ...initial, shouldPrompt: false } : initial,
    ));

    // Act
    await page.getByRole('button', { name: 'Dismiss' }).click();

    // Assert
    await expect.element(page.getByTestId('prompt')).toHaveTextContent('false');
  });

  test.each(['Allow', 'Dismiss'])('logs a failure of %s and keeps the stored state', async (name) => {
    // Arrange
    await renderWithQueryClient(<Probe />);
    await expect.element(page.getByTestId('consent')).toHaveTextContent('unset');
    invokeMock.mockImplementation((channel: string) => (
      channel === 'settings:get-usage-analytics' ? Promise.resolve(initial) : Promise.reject(new Error('write failed'))
    ));

    // Act
    await page.getByRole('button', { name }).click();

    // Assert
    await expect.poll(() => sendMock).toHaveBeenCalledWith('log:write', expect.objectContaining({ level: 'error', event: 'renderer.failure', error: 'write failed' }));
    await expect.element(page.getByTestId('consent')).toHaveTextContent('unset');
  });
});
