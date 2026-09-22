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
  await expect.element(getByText('Application shell')).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Restart app' })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Show log file' })).toBeInTheDocument();
});
