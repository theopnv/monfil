// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { beforeEach, expect, test, vi } from 'vitest';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import UsageAnalyticsCard from './UsageAnalyticsCard';
import type { UsageAnalyticsState } from '../../../shared/contracts';

let state: UsageAnalyticsState;
let invoke: ReturnType<typeof vi.fn>;
let sendMessage: ReturnType<typeof vi.fn>;

beforeEach(() => {
  state = { consent: 'unset', shouldPrompt: true, available: true };
  invoke = vi.fn((channel: string, arg: unknown) => {
    switch (channel) {
      case 'settings:get': return Promise.resolve(state);
      case 'settings:set': return Promise.resolve({ consent: (arg as { value: string }).value, shouldPrompt: false, available: true });
      case 'settings:dismiss-usage-analytics-prompt': return Promise.resolve({ ...state, shouldPrompt: false });
      case 'analytics:preview': return Promise.resolve({ day: '2026-10-23', searches: 2 });
      default: return Promise.resolve(undefined);
    }
  });
  sendMessage = vi.fn();
  window.electron = { ipcRenderer: { invoke, sendMessage, on: vi.fn() } } as unknown as typeof window.electron;
});

test('shows two equal buttons when the card should prompt', async () => {
  // Arrange
  const { getByRole } = await renderWithQueryClient(<UsageAnalyticsCard />);

  // Assert
  const share = getByRole('button', { name: 'Share usage stats' });
  const decline = getByRole('button', { name: 'No thanks' });
  await expect.element(share).toBeInTheDocument();
  expect(share.element().className).toBe(decline.element().className);
});

test('renders nothing when it should not prompt', async () => {
  // Arrange
  state = { consent: 'unset', shouldPrompt: false, available: true };
  const { container } = await renderWithQueryClient(<UsageAnalyticsCard />);

  // Assert
  await vi.waitFor(() => expect(invoke).toHaveBeenCalledWith('settings:get', { key: 'usageAnalytics' }));
  expect(container.querySelector('section')).toBeNull();
});

test('"Share usage stats" stores the grant and hides the card', async () => {
  // Arrange
  const { getByRole } = await renderWithQueryClient(<UsageAnalyticsCard />);

  // Act
  await getByRole('button', { name: 'Share usage stats' }).click();

  // Assert
  expect(invoke).toHaveBeenCalledWith('settings:set', { key: 'usageAnalytics', value: 'granted' });
  await expect.element(getByRole('button', { name: 'No thanks' })).not.toBeInTheDocument();
});

test('"No thanks" stores the refusal', async () => {
  // Arrange
  const { getByRole } = await renderWithQueryClient(<UsageAnalyticsCard />);

  // Act
  await getByRole('button', { name: 'No thanks' }).click();

  // Assert
  expect(invoke).toHaveBeenCalledWith('settings:set', { key: 'usageAnalytics', value: 'denied' });
});

test('the close icon puts the card off for later', async () => {
  // Arrange
  const { getByRole } = await renderWithQueryClient(<UsageAnalyticsCard />);

  // Act
  await getByRole('button', { name: 'Ask me later' }).click();

  // Assert
  expect(invoke).toHaveBeenCalledWith('settings:dismiss-usage-analytics-prompt', undefined);
  await expect.element(getByRole('button', { name: 'No thanks' })).not.toBeInTheDocument();
});

test('"See what is sent" opens the preview', async () => {
  // Arrange
  const { getByRole, getByLabelText } = await renderWithQueryClient(<UsageAnalyticsCard />);

  // Act
  await getByRole('button', { name: 'See what is sent' }).click();

  // Assert
  await vi.waitFor(() => expect(getByLabelText('Usage stats preview').element().textContent).toContain('"searches": 2'));
});

test('the privacy notice link opens in the browser', async () => {
  // Arrange
  const { getByRole } = await renderWithQueryClient(<UsageAnalyticsCard />);

  // Act
  await getByRole('button', { name: 'Privacy notice' }).click();

  // Assert
  expect(sendMessage).toHaveBeenCalledWith('link:open', 'https://monfil.app/docs/user-guide/privacy/');
});
