// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren, ReactNode } from 'react';
import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider } from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { ActiveWorkspaceIdProvider, useActiveWorkspaceId } from '../../providers/workspace-provider';

interface RenderedHook<T> {
  result: { current: T };
  queryClient: QueryClient;
  /** Navigates to `/workspace/<id>` and resolves once the hook has rendered with that workspace. */
  goToWorkspace: (workspaceId: number) => Promise<void>;
}

/**
 * Renders `hook` under the real `ActiveWorkspaceIdProvider` on a memory router, so a test can switch the
 * active workspace while the hook stays mounted and see whether it follows.
 */
export async function renderHookInWorkspace<T>(
  hook: () => T,
  { workspaceId = 1, wrapper: Wrapper = ({ children }: PropsWithChildren) => children }: { workspaceId?: number; wrapper?: (props: PropsWithChildren) => ReactNode } = {},
): Promise<RenderedHook<T>> {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  const result = {} as { current: T };
  let renderedWorkspaceId = 0;

  function Probe() {
    result.current = hook();
    renderedWorkspaceId = useActiveWorkspaceId();
    return null;
  }

  const root = createRootRoute({
    component: () => (
      <QueryClientProvider client={queryClient}>
        <ActiveWorkspaceIdProvider>
          <Wrapper><Probe /></Wrapper>
          <Outlet />
        </ActiveWorkspaceIdProvider>
      </QueryClientProvider>
    ),
  });
  const workspace = createRoute({ getParentRoute: () => root, path: '/workspace/$workspaceId' });
  const router = createRouter({
    routeTree: root.addChildren([workspace]),
    history: createMemoryHistory({ initialEntries: [`/workspace/${workspaceId}`] }),
  });
  await render(<RouterProvider router={router} />);
  await vi.waitFor(() => {
    if (renderedWorkspaceId !== workspaceId) {
      throw new Error('The hook has not rendered yet.');
    }
  });

  return {
    result,
    queryClient,
    goToWorkspace: async (id) => {
      await router.navigate({ to: '/workspace/$workspaceId', params: { workspaceId: String(id) } });
      await vi.waitFor(() => {
        if (renderedWorkspaceId !== id) {
          throw new Error('The hook has not followed the navigation yet.');
        }
      });
    },
  };
}
