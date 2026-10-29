// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { useIpcBridge } from '@/lib/ipc-bridge';
import { dismissAllNotifications, NotificationHost } from '@/lib/notifications';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import { useUpdateNotification } from './app-update';
import type { AppUpdateState } from '../../shared/contracts';

let initialState: AppUpdateState;
let pushUpdateState: ((state: AppUpdateState) => void) | undefined;
let sendMock: ReturnType<typeof vi.fn>;

function UpdateHarness() {
  useIpcBridge();
  useUpdateNotification();
  return <NotificationHost />;
}

beforeEach(() => {
  initialState = { name: 'NONE' };
  pushUpdateState = undefined;
  sendMock = vi.fn();
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn((channel: string) => Promise.resolve(channel === 'app:get-update-state' ? initialState : [])),
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'app:update-state-changed') {
          pushUpdateState = handler as typeof pushUpdateState;
        }
        return vi.fn();
      }),
      once: vi.fn(),
      sendMessage: sendMock,
    },
  } as unknown as typeof window.electron;
});

afterEach(async () => {
  dismissAllNotifications();
  await expect.element(page.getByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
});

describe('useUpdateNotification', () => {
  test('offers a restart when an update finishes downloading', async () => {
    // Arrange
    await renderWithQueryClient(<UpdateHarness />);
    await expect.poll(() => pushUpdateState).toBeDefined();

    // Act
    pushUpdateState?.({ name: 'READY_TO_INSTALL' });
    await page.getByRole('button', { name: 'Restart' }).click();

    // Assert
    await expect.element(page.getByText('A new version of Monfil is ready.', { exact: true })).toBeVisible();
    expect(sendMock).toHaveBeenCalledWith('app:install-update', undefined);
  });

  test('offers a restart for an update downloaded before the window loaded', async () => {
    // Arrange
    initialState = { name: 'READY_TO_INSTALL' };

    // Act
    await renderWithQueryClient(<UpdateHarness />);

    // Assert
    await expect.element(page.getByRole('button', { name: 'Restart' })).toBeVisible();
  });

  test('stays quiet while no update is ready', async () => {
    // Act
    const { queryClient } = await renderWithQueryClient(<UpdateHarness />);
    await expect.poll(() => queryClient.getQueryData(['app-update-state'])).toEqual({ name: 'NONE' });
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Assert
    await expect.element(page.getByRole('button', { name: 'Restart' })).not.toBeInTheDocument();
  });
});
