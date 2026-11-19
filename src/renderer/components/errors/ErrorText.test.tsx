// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { expect, test } from 'vitest';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import { ErrorText } from './ErrorText';

test('shows the sentence of the error name with the params filled in', async () => {
  // Arrange
  const error = { name: 'GENERIC_FETCH_ERROR', message: 'The server had an error (HTTP 502).', params: { reason: 'serverError', status: 502 } };

  // Act
  const { getByText } = await renderWithQueryClient(<ErrorText error={error} />);

  // Assert
  await expect.element(getByText('The server had an error (HTTP 502).', { exact: true })).toBeVisible();
});

test('adds a Details line with the raw text for a technical error', async () => {
  // Arrange
  const error = { name: 'FS_ERROR', message: 'EACCES: permission denied' };

  // Act
  const { getByText } = await renderWithQueryClient(<ErrorText error={error} className="px-6" />);

  // Assert
  await expect.element(getByText('Monfil could not read or write the file.', { exact: true })).toBeVisible();
  await expect.element(getByText('Details: EACCES: permission denied', { exact: true })).toBeVisible();
});

test('shows no Details line when the sentence says it all', async () => {
  // Arrange
  const error = { name: 'FEED_NOT_FOUND', message: 'No feed found with id 4 in workspace 1' };

  // Act
  const { getByText } = await renderWithQueryClient(<ErrorText error={error} />);

  // Assert
  await expect.element(getByText('That feed no longer exists.', { exact: true })).toBeVisible();
  await expect.element(getByText('Details:', { exact: false })).not.toBeInTheDocument();
});
