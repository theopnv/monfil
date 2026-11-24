// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import { ErrorRecovery } from './ErrorRecovery';

function BrokenRoute(): never {
  throw new Error('render failed');
}

test('shows recovery actions when a child route throws', async () => {
  // Arrange
  const rootRoute = createRootRoute({
    component: () => <div>Application shell<Outlet /></div>,
  });
  const brokenRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: BrokenRoute,
    errorComponent: (props) => (
      <ErrorRecovery
        error={props.error}
        onRetry={props.reset}
        onRestart={vi.fn()}
        onShowLog={vi.fn()}
        variant="route"
      />
    ),
  });
  const router = createRouter({
    routeTree: rootRoute.addChildren([brokenRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  });

  // Act
  const { getByRole, getByText } = await renderWithQueryClient(<RouterProvider router={router} />);

  // Assert
  await expect.element(getByRole('heading', { name: 'This page could not be shown' })).toBeInTheDocument();
  await expect.element(getByText('Application shell', { exact: false })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Restart app' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Show log file' })).toBeInTheDocument();
});

test('shows the incident ID of a failure that the renderer logged itself, and the report form while reports are on', async () => {
  // Arrange
  const invoke = vi.fn(() => Promise.resolve({ enabled: true }));
  window.electron = { ipcRenderer: { invoke, sendMessage: vi.fn(), on: vi.fn() } } as unknown as typeof window.electron;

  // Act
  const { getByRole, getByText } = await renderWithQueryClient(
    <ErrorRecovery error={new Error('render failed')} incidentId="0a1b2c3d-1111-2222-3333-444455556666" variant="root" onRetry={vi.fn()} />,
  );

  // Assert
  await expect.element(getByText('incident 0a1b2c3d', { exact: false })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Add details' })).toBeInTheDocument();
});

test('shows no report form when error reports are off', async () => {
  // Arrange
  const invoke = vi.fn(() => Promise.resolve({ enabled: false }));
  window.electron = { ipcRenderer: { invoke, sendMessage: vi.fn(), on: vi.fn() } } as unknown as typeof window.electron;

  // Act
  const { getByRole } = await renderWithQueryClient(<ErrorRecovery error={new Error('render failed')} variant="root" onRetry={vi.fn()} />);

  // Assert
  await vi.waitFor(() => expect(invoke).toHaveBeenCalled());
  await expect.element(getByRole('button', { name: 'Add details' })).not.toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Show log file' })).toBeInTheDocument();
});
