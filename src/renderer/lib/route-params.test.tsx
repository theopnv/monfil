// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect } from 'react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider, useParams } from '@tanstack/react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ActiveWorkspaceIdProvider, useActiveWorkspaceId } from '@/providers/workspace-provider';
import { ipc } from '@/lib/ipc-client';
import { Route as WorkspaceRoute } from '../routes/workspace.$workspaceId';
import { Route as ReaderRoute } from '../routes/workspace.$workspaceId_.reader.$itemId';

vi.mock(import('@/components/Home/Home'), () => ({ default: HomeProbe }));
vi.mock(import('@/components/Reader/Reader'), () => ({ default: ReaderProbe }));

function HomeProbe() {
  const workspaceId = useActiveWorkspaceId();
  useEffect(() => {
    void ipc.invoke('feeds:list', { workspaceId });
  }, [workspaceId]);
  return <div>Home workspace {workspaceId}</div>;
}

function ReaderProbe({ itemId }: { itemId: string }) {
  const workspaceId = useActiveWorkspaceId();
  useEffect(() => {
    void ipc.invoke('items:query', { workspaceId, ids: [Number(itemId)], limit: 1 });
  }, [workspaceId, itemId]);
  return <div>Reader item {itemId} in workspace {workspaceId}</div>;
}

function ReaderScreen() {
  const { itemId } = useParams({ strict: false });
  return <ReaderProbe itemId={itemId ?? ''} />;
}

const invoke = vi.fn().mockResolvedValue([]);

beforeEach(() => {
  invoke.mockClear();
  window.electron = { ipcRenderer: { invoke, on: vi.fn(), once: vi.fn(), sendMessage: vi.fn() } };
});

function createTestRouter(path: string) {
  const root = createRootRoute({
    component: () => <ActiveWorkspaceIdProvider><Outlet /></ActiveWorkspaceIdProvider>,
  });
  const workspace = createRoute({
    getParentRoute: () => root,
    path: '/workspace/$workspaceId',
    params: { parse: (params) => WorkspaceRoute.options.params?.parse?.(params) ?? params },
    component: HomeProbe,
  });
  const reader = createRoute({
    getParentRoute: () => root,
    path: '/workspace/$workspaceId/reader/$itemId',
    params: { parse: (params) => ReaderRoute.options.params?.parse?.(params) ?? params },
    component: ReaderScreen,
  });
  return createRouter({
    routeTree: root.addChildren([workspace, reader]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
}

test.each(['NaN', 'Infinity', '0', '-1', '1.5', '9007199254740992', '1e2', '0x10', '%20', '1%0A'])('redirects invalid workspace ID %s to Home', async (id) => {
  // Arrange
  const router = createTestRouter(`/workspace/${id}`);

  // Act
  const screen = await render(<RouterProvider router={router} />);

  // Assert
  await expect.element(screen.getByText('Home workspace 1')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/workspace/1');
  expect(router.history.length).toBe(1);
  expect(invoke).toHaveBeenCalledWith('feeds:list', { workspaceId: 1 });
  expect(invoke.mock.calls.every(([, arg]) => arg.workspaceId === 1)).toBe(true);
});

test.each(['/workspace/NaN/reader/4', '/workspace/2/reader/0', '/workspace/2/reader/1.5', '/workspace/2/reader/9007199254740992'])('redirects invalid Reader URL %s before item queries', async (path) => {
  // Arrange
  const router = createTestRouter(path);

  // Act
  const screen = await render(<RouterProvider router={router} />);

  // Assert
  await expect.element(screen.getByText('Home workspace 1')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/workspace/1');
  expect(invoke.mock.calls.every(([channel]) => channel === 'feeds:list')).toBe(true);
});

test('keeps valid workspace and item parameters as strings', async () => {
  // Arrange
  const router = createTestRouter('/workspace/2/reader/4');

  // Act
  const screen = await render(<RouterProvider router={router} />);

  // Assert
  await expect.element(screen.getByText('Reader item 4 in workspace 2')).toBeInTheDocument();
  expect(router.state.location.pathname).toBe('/workspace/2/reader/4');
  expect(invoke).toHaveBeenCalledWith('items:query', { workspaceId: 2, ids: [4], limit: 1 });
});

test.each(['NaN', '0', '1.5'])('the workspace provider uses Home while it has invalid parameter %s', async (workspaceId) => {
  // Arrange
  const root = createRootRoute({ component: () => <ActiveWorkspaceIdProvider><Outlet /></ActiveWorkspaceIdProvider> });
  const route = createRoute({ getParentRoute: () => root, path: '/$workspaceId', component: HomeProbe });
  const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: [`/${workspaceId}`] }) });

  // Act
  const screen = await render(<RouterProvider router={router} />);

  // Assert
  await expect.element(screen.getByText('Home workspace 1')).toBeInTheDocument();
  expect(invoke).toHaveBeenCalledWith('feeds:list', { workspaceId: 1 });
});

test('the workspace provider uses Home off a workspace route', async () => {
  // Arrange
  const root = createRootRoute({ component: () => <ActiveWorkspaceIdProvider><Outlet /></ActiveWorkspaceIdProvider> });
  const route = createRoute({ getParentRoute: () => root, path: '/settings', component: HomeProbe });
  const router = createRouter({ routeTree: root.addChildren([route]), history: createMemoryHistory({ initialEntries: ['/settings'] }) });

  // Act
  const screen = await render(<RouterProvider router={router} />);

  // Assert
  await expect.element(screen.getByText('Home workspace 1')).toBeInTheDocument();
  expect(invoke).toHaveBeenCalledWith('feeds:list', { workspaceId: 1 });
});
