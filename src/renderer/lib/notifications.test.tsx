// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import { dismissAllNotifications, notifyError, notifyWarning, NotificationHost } from './notifications';

afterEach(async () => {
  dismissAllNotifications();
  await expect.element(page.getByRole('listitem')).not.toBeInTheDocument();
});

describe('notifyError', () => {
  test('shows one message for a key that is already open', async () => {
    // Arrange
    await render(<NotificationHost />);
    notifyError('Could not save', 'save');

    // Act
    notifyError('Could not save again', 'save');

    // Assert
    await expect.element(page.getByText('Could not save', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Could not save again', { exact: true })).not.toBeInTheDocument();
  });

  test('shows the message again once the user dismissed it', async () => {
    // Arrange
    await render(<NotificationHost />);
    notifyError('Could not save');
    await expect.element(page.getByText('Could not save', { exact: true })).toBeVisible();
    dismissAllNotifications();
    await expect.element(page.getByText('Could not save', { exact: true })).not.toBeInTheDocument();

    // Act
    notifyError('Could not save');

    // Assert
    await expect.element(page.getByText('Could not save', { exact: true })).toBeVisible();
  });

  test('shows the message again once it closed on its own', { timeout: 15000 }, async () => {
    // Arrange
    await render(<NotificationHost />);
    notifyError('Could not save');
    await expect.element(page.getByText('Could not save', { exact: true })).toBeVisible();
    await expect.element(page.getByText('Could not save', { exact: true }), { timeout: 10000 }).not.toBeInTheDocument();

    // Act
    notifyError('Could not save');

    // Assert
    await expect.element(page.getByText('Could not save', { exact: true })).toBeVisible();
  });
});

describe('notifyWarning', () => {
  test('has a close button that lets the same warning show again', async () => {
    // Arrange
    await render(<NotificationHost />);
    notifyWarning('Something failed.', 'same-key');
    await expect.element(page.getByText('Something failed.', { exact: true })).toBeVisible();

    // Act
    await page.getByRole('button', { name: 'Close toast' }).click();
    await expect.element(page.getByText('Something failed.', { exact: true })).not.toBeInTheDocument();
    notifyWarning('Something failed.', 'same-key');

    // Assert
    await expect.element(page.getByText('Something failed.', { exact: true })).toBeVisible();
  });

  test('keeps the first action for a key that is already open', async () => {
    // Arrange
    await render(<NotificationHost />);
    notifyWarning('Check this', 'check', { label: 'First', onClick: vi.fn() });

    // Act
    notifyWarning('Check this', 'check', { label: 'Second', onClick: vi.fn() });

    // Assert
    await expect.element(page.getByRole('button', { name: 'First' })).toBeVisible();
    await expect.element(page.getByRole('button', { name: 'Second' })).not.toBeInTheDocument();
  });

  test('shows the warning again once the user dismissed it', async () => {
    // Arrange
    await render(<NotificationHost />);
    notifyWarning('Check this', 'check', { label: 'First', onClick: vi.fn() });
    await expect.element(page.getByRole('button', { name: 'First' })).toBeVisible();
    dismissAllNotifications();
    await expect.element(page.getByRole('button', { name: 'First' })).not.toBeInTheDocument();

    // Act
    notifyWarning('Check this', 'check', { label: 'Second', onClick: vi.fn() });

    // Assert
    await expect.element(page.getByRole('button', { name: 'Second' })).toBeVisible();
  });
});
