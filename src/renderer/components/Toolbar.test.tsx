import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet, RouterProvider } from '@tanstack/react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { RouteProvider } from '@/providers/route-provider';
import { ActiveWorkspaceIdProvider } from '@/providers/workspace-provider';
import { useFeeds } from '@/providers/feeds-provider';
import { useIpcBridge } from '@/lib/ipc-bridge';
import { createTestQueryClient } from '@/lib/test/render-with-query-client';
import Toolbar from './Toolbar';
import type { DeleteWorkspaceError } from '../../main/db/crud/delete';
import type { UpdateWorkspaceError } from '../../main/db/crud/update';
import type { Result } from '../../main/lib/utils';
import type { FeedSummary, WorkspaceSummary } from '../../preload/channels';

function createWorkspace(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
  return {
    id: 1,
    name: 'Home',
    icon: 'Home02',
    color: '#d67f48',
    position: 0,
    source_slug: undefined,
    source_version: undefined,
    installed_at: undefined,
    hasUnread: false,
    ...overrides,
  };
}

function createFeed(overrides: Partial<FeedSummary> = {}): FeedSummary {
  const id = overrides.id ?? 1;
  return {
    id,
    link: `https://example.com/feed-${id}`,
    title: `Feed ${id}`,
    type: 'rss',
    showInWorkspace: 1,
    workspaceId: 1,
    last_fetched_at: undefined,
    last_error: undefined,
    icon: undefined,
    category: { id: 1, name: 'Tech', workspace_id: 1 },
    itemCount: 0,
    unreadCount: 0,
    ...overrides,
  };
}

let workspaces: WorkspaceSummary[];
let feedsByWorkspace: Record<number, FeedSummary[]>;
let updateWorkspaceResult: Result<WorkspaceSummary, UpdateWorkspaceError> | undefined;
let deleteWorkspaceResult: Result<void, DeleteWorkspaceError> | undefined;
let editWorkspaceRequestedHandler: ((workspaceId: number) => void) | undefined;
let exportWorkspaceRequestedHandler: ((workspaceId: number) => void) | undefined;
let deleteWorkspaceRequestedHandler: ((workspaceId: number) => void) | undefined;
let invokeMock: ReturnType<typeof vi.fn>;
let feedpacks: { slug: string; title: string; description: string; tags: string[]; curator: string; sourceCount: number; updatedAt: string; opml: string }[];

beforeEach(() => {
  workspaces = [];
  feedsByWorkspace = {};
  updateWorkspaceResult = undefined;
  deleteWorkspaceResult = undefined;
  editWorkspaceRequestedHandler = undefined;
  exportWorkspaceRequestedHandler = undefined;
  deleteWorkspaceRequestedHandler = undefined;
  feedpacks = [];

  invokeMock = vi.fn((channel: string, arg: unknown) => {
    switch (channel) {
      case 'workspaces:list':
        return Promise.resolve(workspaces);
      case 'feeds:list':
        return Promise.resolve(feedsByWorkspace[(arg as { workspaceId: number }).workspaceId] ?? []);
      case 'feeds:list-categories':
        return Promise.resolve([]);
      case 'workspaces:update': {
        const { workspaceId, ...patch } = arg as { workspaceId: number; name?: string; icon?: string; color?: string };
        const existing = workspaces.find((workspace) => workspace.id === workspaceId);
        const result = updateWorkspaceResult ?? (existing && { success: true, data: { ...existing, ...patch } });
        if (result?.success) {
          workspaces = workspaces.map((workspace) => (workspace.id === workspaceId ? { ...workspace, ...patch } : workspace));
        }
        return Promise.resolve(result);
      }
      case 'workspaces:delete': {
        const { workspaceId } = arg as { workspaceId: number };
        const result = deleteWorkspaceResult ?? { success: true, data: undefined };
        if (result.success) {
          workspaces = workspaces.filter((workspace) => workspace.id !== workspaceId);
        }
        return Promise.resolve(result);
      }
      case 'opml:export':
        return Promise.resolve({ success: true, data: undefined });
      case 'feedpacks:list':
        return Promise.resolve({ success: true, data: { version: 1, packs: feedpacks } });
      case 'feedpacks:preview': {
        const pack = feedpacks.find((candidate) => candidate.slug === (arg as { slug: string }).slug);
        return Promise.resolve(pack
          ? { success: true, data: { pack, sources: { title: pack.title, categories: [{ name: 'Engineering', feeds: [{ title: 'Source', xmlUrl: 'https://example.com/feed', type: 'rss' }] }] } } }
          : { success: false, error: { name: 'PACK_NOT_FOUND', message: 'Missing pack.' } });
      }
      case 'feedpacks:install':
        return Promise.resolve({ success: true, data: { workspaceId: 3, imported: 1, skipped: [], failed: [] } });
      default:
        return Promise.resolve([]);
    }
  });

  window.electron = {
    ipcRenderer: {
      invoke: invokeMock,
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'workspaces:edit-requested') {
          editWorkspaceRequestedHandler = handler as typeof editWorkspaceRequestedHandler;
        }
        if (channel === 'workspaces:export-requested') {
          exportWorkspaceRequestedHandler = handler as typeof exportWorkspaceRequestedHandler;
        }
        if (channel === 'workspaces:delete-requested') {
          deleteWorkspaceRequestedHandler = handler as typeof deleteWorkspaceRequestedHandler;
        }
        return vi.fn();
      }),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

function FeedsList() {
  const feeds = useFeeds();
  return <ul aria-label="Feeds in workspace">{feeds.map((feed) => <li key={feed.id}>{feed.title}</li>)}</ul>;
}

function IpcBridgeMount() {
  useIpcBridge();
  return null;
}

function renderApp(initialPath: string) {
  const rootRoute = createRootRoute({
    component: () => (
      <RouteProvider>
        <ActiveWorkspaceIdProvider>
          <IpcBridgeMount />
          <div className="flex">
            <Toolbar />
            <Outlet />
          </div>
        </ActiveWorkspaceIdProvider>
      </RouteProvider>
    ),
  });
  const workspaceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/workspace/$workspaceId', component: FeedsList });
  const router = createRouter({
    routeTree: rootRoute.addChildren([workspaceRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test('shows a dot only for a workspace with unread items', async () => {
  // Arrange
  workspaces = [
    createWorkspace({ id: 1, name: 'Home', hasUnread: false }),
    createWorkspace({ id: 2, name: 'CI/CD watch', hasUnread: true }),
  ];

  // Act
  const { getByRole } = await renderApp('/workspace/1');

  // Assert
  await expect.element(getByRole('link', { name: 'CI/CD watch' }).getByTestId('unread-dot')).toBeInTheDocument();
  await expect.element(getByRole('link', { name: 'Home' }).getByTestId('unread-dot')).not.toBeInTheDocument();
});

test('loads the feedpack catalog only when its browser opens', async () => {
  // Arrange
  workspaces = [createWorkspace()];
  const { getByRole } = await renderApp('/workspace/1');

  // Assert
  expect(invokeMock).not.toHaveBeenCalledWith('feedpacks:list', undefined);

  // Act
  await getByRole('button', { name: 'New workspace' }).click();
  await getByRole('button', { name: 'Browse feedpacks' }).click();

  // Assert
  await expect.poll(() => invokeMock.mock.calls.some(([channel]) => channel === 'feedpacks:list')).toBe(true);
});

test('installs a selected feedpack with standard workspace details', async () => {
  // Arrange
  feedpacks = [{ slug: 'devsecops-watch', title: 'DevSecOps Watch', description: 'Testing sources.', tags: ['testing'], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-09-21', opml: 'devsecops-watch.opml' }];
  const { getByRole } = await renderApp('/workspace/1');
  await getByRole('button', { name: 'New workspace' }).click();
  await getByRole('button', { name: 'Browse feedpacks' }).click();

  // Act
  await getByRole('button', { name: /DevSecOps Watch.*Testing sources/ }).click();
  await getByRole('button', { name: 'Install' }).click();

  // Assert
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('feedpacks:install', {
    slug: 'devsecops-watch',
    target: {
      kind: 'new-workspace',
      name: 'DevSecOps Watch',
      icon: 'Code01',
      color: '#d67f48',
    },
  }));
});

test('keeps workspace details out of the feedpack browser', async () => {
  // Arrange
  feedpacks = [{ slug: 'devsecops-watch', title: 'DevSecOps Watch', description: 'Testing sources.', tags: ['testing'], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-09-21', opml: 'devsecops-watch.opml' }];
  const { getByRole } = await renderApp('/workspace/1');
  await getByRole('button', { name: 'New workspace' }).click();
  await getByRole('button', { name: 'Browse feedpacks' }).click();

  // Act
  await getByRole('button', { name: /DevSecOps Watch.*Testing sources/ }).click();

  // Assert
  await expect.element(getByRole('button', { name: 'ShieldTick' })).not.toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Colour #a855f7' })).not.toBeInTheDocument();
});

test('switching tabs swaps the river to the other workspace\'s feeds', async () => {
  // Arrange
  workspaces = [
    createWorkspace({ id: 1, name: 'Home' }),
    createWorkspace({ id: 2, name: 'CI/CD watch' }),
  ];
  feedsByWorkspace = {
    1: [createFeed({ id: 1, title: 'Home feed', workspaceId: 1 })],
    2: [createFeed({ id: 2, title: 'Pack feed', workspaceId: 2 })],
  };
  const { getByRole, getByText } = await renderApp('/workspace/1');
  await expect.element(getByText('Home feed', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('link', { name: 'CI/CD watch' }).click();

  // Assert
  await expect.element(getByText('Pack feed', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Home feed', { exact: true })).not.toBeInTheDocument();
});

test('right-clicking a workspace sends workspaces:show-context-menu with its id', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' })];
  const { getByRole } = await renderApp('/workspace/1');

  // Act
  await getByRole('link', { name: 'Home' }).click({ button: 'right' });

  // Assert
  expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('workspaces:show-context-menu', 1);
});

test('firing workspaces:edit-requested opens the edit dialog prefilled with the workspace', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 2, name: 'CI/CD watch', icon: 'Terminal', color: '#3b82f6' })];
  const { getByRole } = await renderApp('/workspace/2');

  // Act
  editWorkspaceRequestedHandler?.(2);

  // Assert
  await expect.element(getByRole('heading', { name: 'Edit workspace' })).toBeInTheDocument();
  await expect.element(getByRole('textbox', { name: 'Name' })).toHaveValue('CI/CD watch');
  await expect.element(getByRole('button', { name: 'Terminal' })).toHaveAttribute('aria-pressed', 'true');
});

test('saving the edit dialog renames the workspace and updates its icon and colour', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 2, name: 'CI/CD watch', icon: 'Terminal', color: '#3b82f6' })];
  const { getByRole } = await renderApp('/workspace/2');
  editWorkspaceRequestedHandler?.(2);
  await expect.element(getByRole('heading', { name: 'Edit workspace' })).toBeInTheDocument();

  // Act
  await getByRole('textbox', { name: 'Name' }).fill('Infra watch');
  await getByRole('button', { name: 'Rocket02' }).click();
  await getByRole('button', { name: 'Colour #ef4444' }).click();
  await getByRole('button', { name: 'Save changes' }).click();

  // Assert
  expect(invokeMock).toHaveBeenCalledWith('workspaces:update', { workspaceId: 2, name: 'Infra watch', icon: 'Rocket02', color: '#ef4444' });
  await expect.element(getByRole('heading', { name: 'Edit workspace' })).not.toBeInTheDocument();
  await expect.element(getByRole('link', { name: 'Infra watch' })).toBeInTheDocument();
});

test('firing workspaces:export-requested invokes opml:export with the workspace id', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 2, name: 'CI/CD watch' })];
  await renderApp('/workspace/2');

  // Act
  exportWorkspaceRequestedHandler?.(2);

  // Assert
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('opml:export', { workspaceId: 2 }));
});

test('a failed edit keeps the dialog open and shows the error', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 2, name: 'CI/CD watch' })];
  updateWorkspaceResult = { success: false, error: { name: 'DB_ERROR', message: 'Could not update the workspace.' } };
  const { getByRole, getByText } = await renderApp('/workspace/2');
  editWorkspaceRequestedHandler?.(2);

  // Act
  await getByRole('button', { name: 'Save changes' }).click();

  // Assert
  await expect.element(getByText('Could not update the workspace.', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Edit workspace' })).toBeInTheDocument();
});

test('firing workspaces:delete-requested opens the delete dialog for that workspace', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 2, name: 'CI/CD watch' })];
  const { getByRole, getByText } = await renderApp('/workspace/2');

  // Act
  deleteWorkspaceRequestedHandler?.(2);

  // Assert
  await expect.element(getByRole('heading', { name: 'Delete workspace' })).toBeInTheDocument();
  await expect.element(getByText('CI/CD watch', { exact: true })).toBeInTheDocument();
});

test('exporting from the delete dialog invokes opml:export and leaves the dialog open', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 2, name: 'CI/CD watch' })];
  const { getByRole } = await renderApp('/workspace/2');
  deleteWorkspaceRequestedHandler?.(2);

  // Act
  await getByRole('button', { name: 'Export as OPML' }).click();

  // Assert
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('opml:export', { workspaceId: 2 }));
  await expect.element(getByRole('heading', { name: 'Delete workspace' })).toBeInTheDocument();
});

test('confirming delete on the active workspace removes it and navigates to Home', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  feedsByWorkspace = { 1: [createFeed({ id: 1, title: 'Home feed', workspaceId: 1 })] };
  const { getByRole, getByText } = await renderApp('/workspace/2');
  deleteWorkspaceRequestedHandler?.(2);

  // Act
  await getByRole('button', { name: 'Delete workspace' }).click();

  // Assert
  expect(invokeMock).toHaveBeenCalledWith('workspaces:delete', { workspaceId: 2 });
  await expect.element(getByRole('link', { name: 'CI/CD watch' })).not.toBeInTheDocument();
  await expect.element(getByText('Home feed', { exact: true })).toBeInTheDocument();
});

test('a failed delete keeps the dialog open and shows the error', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 2, name: 'CI/CD watch' })];
  deleteWorkspaceResult = { success: false, error: { name: 'DB_ERROR', message: 'Could not delete the workspace.' } };
  const { getByRole, getByText } = await renderApp('/workspace/2');
  deleteWorkspaceRequestedHandler?.(2);

  // Act
  await getByRole('button', { name: 'Delete workspace' }).click();

  // Assert
  await expect.element(getByText('Could not delete the workspace.', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Delete workspace' })).toBeInTheDocument();
});
