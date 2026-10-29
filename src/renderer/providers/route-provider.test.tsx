// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createMemoryHistory, createRootRoute, createRoute, createRouter, RouterProvider } from '@tanstack/react-router';
import { Link } from 'react-aria-components';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { RouteProvider } from './route-provider';

async function renderLinkAt(path: string) {
  const root = createRootRoute({
    component: () => <RouteProvider><Link href="/workspace/2">Go to workspace 2</Link></RouteProvider>,
  });
  const workspace = createRoute({ getParentRoute: () => root, path: '/workspace/$workspaceId' });
  const router = createRouter({
    routeTree: root.addChildren([workspace]),
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  const screen = await render(<RouterProvider router={router} />);
  return { router, ...screen };
}

test('a link takes the href of the route it points to, not the one of the current page', async () => {
  // Act
  const { getByRole } = await renderLinkAt('/workspace/1');

  // Assert
  await expect.element(getByRole('link', { name: 'Go to workspace 2' })).toHaveAttribute('href', '/workspace/2');
});

test('a click on a link moves the router to its route', async () => {
  // Arrange
  const { router, getByRole } = await renderLinkAt('/workspace/1');

  // Act
  await getByRole('link', { name: 'Go to workspace 2' }).click();

  // Assert
  await expect.poll(() => router.state.location.pathname).toBe('/workspace/2');
});
