// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { dismissAllNotifications, NotificationHost, notifyWarning } from './notifications';

afterEach(() => {
  dismissAllNotifications();
});

test('a warning has a close button, and closing it lets the same warning show again', async () => {
  // Arrange
  const { getByText, getByRole } = await render(<NotificationHost />);
  notifyWarning('Something failed.', 'same-key');
  await expect.element(getByText('Something failed.', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Close toast' }).click();
  await expect.element(getByText('Something failed.', { exact: true })).not.toBeInTheDocument();
  notifyWarning('Something failed.', 'same-key');

  // Assert
  await expect.element(getByText('Something failed.', { exact: true })).toBeInTheDocument();
});
