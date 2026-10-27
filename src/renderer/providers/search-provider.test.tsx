// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { createMemoryHistory, createRootRoute, createRoute, createRouter, Outlet, RouterProvider, useParams, useRouter } from '@tanstack/react-router';
import { expect, test } from 'vitest';
import { render } from 'vitest-browser-react';
import { parseRouteId } from '@/lib/route-params';
import { SearchProvider, useSearch } from './search-provider';

function SearchProbe() {
  const feed = useSearch();
  const saved = useSearch(true);
  const router = useRouter();
  return (
    <>
      <input aria-label="Feed search" value={feed.query} onChange={(event) => feed.setQuery(event.target.value)} />
      <input aria-label="Saved search" value={saved.query} onChange={(event) => saved.setQuery(event.target.value)} />
      <button type="button" onClick={() => void router.history.push('/workspace/1')}>Workspace 1</button>
      <button type="button" onClick={() => void router.history.push('/workspace/2')}>Workspace 2</button>
      <button type="button" onClick={() => void router.history.push('/workspace/1/reader/7')}>Reader</button>
      <button type="button" onClick={() => void router.history.push('/settings')}>Settings</button>
    </>
  );
}

function Root() {
  const workspaceId = parseRouteId(useParams({ strict: false }).workspaceId);
  return (
    <SearchProvider workspaceId={workspaceId}>
      <SearchProbe />
      <Outlet />
    </SearchProvider>
  );
}

function renderAt(initialPath: string) {
  const rootRoute = createRootRoute({ component: Root });
  const routes = ['/workspace/$workspaceId', '/workspace/$workspaceId/reader/$itemId', '/settings']
    .map((path) => createRoute({ getParentRoute: () => rootRoute, path }));
  const router = createRouter({
    routeTree: rootRoute.addChildren(routes),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });
  return render(<RouterProvider router={router} />);
}

test('clears the feed and saved searches when switching to another workspace', async () => {
  // Arrange
  const { getByRole } = await renderAt('/workspace/1');
  await getByRole('textbox', { name: 'Feed search' }).fill('kubernetes');
  await getByRole('textbox', { name: 'Saved search' }).fill('rust');

  // Act
  await getByRole('button', { name: 'Workspace 2' }).click();

  // Assert
  await expect.element(getByRole('textbox', { name: 'Feed search' })).toHaveValue('');
  await expect.element(getByRole('textbox', { name: 'Saved search' })).toHaveValue('');
});

test('keeps the search while reading an article of the same workspace', async () => {
  // Arrange
  const { getByRole } = await renderAt('/workspace/1');
  await getByRole('textbox', { name: 'Feed search' }).fill('kubernetes');

  // Act
  await getByRole('button', { name: 'Reader' }).click();

  // Assert
  await expect.element(getByRole('textbox', { name: 'Feed search' })).toHaveValue('kubernetes');
});

test('keeps the search across a visit to a page with no workspace', async () => {
  // Arrange
  const { getByRole } = await renderAt('/workspace/1');
  await getByRole('textbox', { name: 'Feed search' }).fill('kubernetes');

  // Act
  await getByRole('button', { name: 'Settings' }).click();
  await getByRole('button', { name: 'Workspace 1' }).click();

  // Assert
  await expect.element(getByRole('textbox', { name: 'Feed search' })).toHaveValue('kubernetes');
});
