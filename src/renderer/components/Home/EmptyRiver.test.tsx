import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { expect, test, vi } from 'vitest';
import { ActiveWorkspaceIdProvider } from '@/providers/workspace-provider';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import EmptyRiver from './EmptyRiver';
import { HOME_WORKSPACE_ID } from '../../../shared/contracts';

function renderAt(initialPath: string, onImportOpml: () => void, onImportFeedpack = vi.fn()) {
  const rootRoute = createRootRoute({
    component: () => (
      <ActiveWorkspaceIdProvider>
        <EmptyRiver onImportOpml={onImportOpml} onImportFeedpack={onImportFeedpack} />
      </ActiveWorkspaceIdProvider>
    ),
  });
  const workspaceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/workspace/$workspaceId' });
  const router = createRouter({
    routeTree: rootRoute.addChildren([workspaceRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return renderWithQueryClient(<RouterProvider router={router} />);
}

test('Home shows the onboarding copy and "Add your first feed"', async () => {
  // Act
  const { getByRole, getByText } = await renderAt(`/workspace/${HOME_WORKSPACE_ID}`, vi.fn());

  // Assert
  await expect.element(getByText('Pick your sources', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Add your first feed' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Import OPML' })).not.toBeInTheDocument();
});

test('a non-Home workspace shows an "Import OPML" button instead', async () => {
  // Act
  const { getByRole, getByText } = await renderAt('/workspace/2', vi.fn());

  // Assert
  await expect.element(getByText('Nothing here yet', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Import OPML' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Add your first feed' })).not.toBeInTheDocument();
});

test('clicking "Import OPML" calls onImportOpml', async () => {
  // Arrange
  const onImportOpml = vi.fn();
  const { getByRole } = await renderAt('/workspace/2', onImportOpml);

  // Act
  await getByRole('button', { name: 'Import OPML' }).click();

  // Assert
  expect(onImportOpml).toHaveBeenCalled();
});

test('clicking "Import feedpack" calls onImportFeedpack', async () => {
  // Arrange
  const onImportFeedpack = vi.fn();
  const { getByRole } = await renderAt('/workspace/2', vi.fn(), onImportFeedpack);

  // Act
  await getByRole('button', { name: 'Import feedpack' }).click();

  // Assert
  expect(onImportFeedpack).toHaveBeenCalled();
});
