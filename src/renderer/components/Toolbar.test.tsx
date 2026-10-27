// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, createMemoryHistory, Outlet, RouterProvider, useParams } from '@tanstack/react-router';
import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { userEvent } from 'vitest/browser';
import { RouteProvider } from '@/providers/route-provider';
import { ActiveWorkspaceIdProvider } from '@/providers/workspace-provider';
import { useFeeds } from '@/providers/feeds-provider';
import { useFeedpackRefreshing, useIpcBridge } from '@/lib/ipc-bridge';
import { createTestQueryClient } from '@/lib/test/render-with-query-client';
import Toolbar from './Toolbar';
import type { DeleteWorkspaceError } from '../../shared/contracts';
import type { UpdateWorkspaceError } from '../../shared/contracts';
import type { Result } from '../../shared/result';
import type { FeedSummary, WorkspaceSummary } from '../../shared/contracts';

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
    otherWorkspaceCount: 0,
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
let reorderResponse: Promise<Result<void, UpdateWorkspaceError>> | undefined;
let installedCount: number;
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
  installedCount = 1;
  reorderResponse = undefined;

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
      case 'workspaces:reorder': {
        if (reorderResponse) {
          return reorderResponse;
        }
        const { orderedIds } = arg as { orderedIds: number[] };
        workspaces = orderedIds.flatMap((id) => workspaces.filter((workspace) => workspace.id === id));
        return Promise.resolve({ success: true, data: undefined });
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
        return Promise.resolve({ success: true, data: { workspaceId: 3, imported: installedCount, skipped: [], failed: [] } });
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
  const { workspaceId } = useParams({ strict: false });
  const isRefreshing = useFeedpackRefreshing(workspaceId === undefined ? undefined : Number(workspaceId));
  return (
    <>
      <ul aria-label="Feeds in workspace">{feeds.map((feed) => <li key={feed.id}>{feed.title}</li>)}</ul>
      {isRefreshing && <p>Fetching sources</p>}
    </>
  );
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
  const readerRoute = createRoute({ getParentRoute: () => rootRoute, path: '/workspace/$workspaceId/reader/$itemId', component: () => <p>Reader</p> });
  const router = createRouter({
    routeTree: rootRoute.addChildren([workspaceRoute, readerRoute]),
    history: createMemoryHistory({ initialEntries: [initialPath] }),
  });

  return render(
    <QueryClientProvider client={createTestQueryClient()}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

test('keeps workspace icons free of unread badges', async () => {
  // Arrange
  workspaces = [
    createWorkspace({ id: 1, name: 'Home', hasUnread: false }),
    createWorkspace({ id: 2, name: 'CI/CD watch', hasUnread: true }),
  ];

  // Act
  const { getByRole } = await renderApp('/workspace/1');

  // Assert
  await expect.element(getByRole('link', { name: 'CI/CD watch' })).toBeInTheDocument();
  await expect.element(getByRole('link', { name: 'CI/CD watch' }).getByTestId('unread-dot')).not.toBeInTheDocument();
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

test('installs a selected feedpack with the name, icon and colour picked before browsing', async () => {
  // Arrange
  feedpacks = [{ slug: 'devsecops-watch', title: 'DevSecOps Watch', description: 'Testing sources.', tags: ['testing'], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-09-21', opml: 'devsecops-watch.opml' }];
  const { getByRole } = await renderApp('/workspace/1');
  await getByRole('button', { name: 'New workspace' }).click();
  await getByRole('textbox', { name: 'Name' }).fill('My packs');
  await getByRole('button', { name: 'ShieldTick' }).click();
  await getByRole('button', { name: 'Colour #a855f7' }).click();
  await getByRole('button', { name: 'Browse feedpacks' }).click();

  // Act
  await getByRole('button', { name: /DevSecOps Watch.*Testing sources/ }).click();
  await getByRole('button', { name: 'Install' }).click();

  // Assert
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('feedpacks:install', {
    slug: 'devsecops-watch',
    target: { kind: 'new-workspace', name: 'My packs', icon: 'ShieldTick', color: '#a855f7' },
  }));
});

test('filters feedpacks by keyword', async () => {
  // Arrange
  feedpacks = [
    { slug: 'devsecops-watch', title: 'DevSecOps Watch', description: 'Testing sources.', tags: ['security'], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-09-21', opml: 'devsecops-watch.opml' },
    { slug: 'graphics', title: 'Graphics Programming', description: 'Rendering news.', tags: ['gpu'], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-09-21', opml: 'graphics.opml' },
  ];
  const { getByRole } = await renderApp('/workspace/1');
  await getByRole('button', { name: 'New workspace' }).click();
  await getByRole('button', { name: 'Browse feedpacks' }).click();

  // Act
  await getByRole('searchbox', { name: 'Search feedpacks' }).fill('gpu');

  // Assert
  await expect.element(getByRole('button', { name: /Graphics Programming/ })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: /DevSecOps Watch/ })).not.toBeInTheDocument();
});

test('offers the way back to the catalog from the dialog footer', async () => {
  // Arrange
  feedpacks = [{ slug: 'devsecops-watch', title: 'DevSecOps Watch', description: 'Testing sources.', tags: ['testing'], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-09-21', opml: 'devsecops-watch.opml' }];
  const { getByRole } = await renderApp('/workspace/1');
  await getByRole('button', { name: 'New workspace' }).click();
  await getByRole('button', { name: 'Browse feedpacks' }).click();
  await getByRole('button', { name: /DevSecOps Watch.*Testing sources/ }).click();

  // Act
  await getByRole('button', { name: 'Back to feedpacks' }).click();

  // Assert
  await expect.element(getByRole('button', { name: /DevSecOps Watch.*Testing sources/ })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Install' })).not.toBeInTheDocument();
});

test('does not wait for sources when a feedpack adds nothing', async () => {
  // Arrange
  installedCount = 0;
  feedpacks = [{ slug: 'devsecops-watch', title: 'DevSecOps Watch', description: 'Testing sources.', tags: ['testing'], curator: 'Monfil', sourceCount: 1, updatedAt: '2026-09-21', opml: 'devsecops-watch.opml' }];
  const { getByRole, getByText } = await renderApp('/workspace/1');
  await getByRole('button', { name: 'New workspace' }).click();
  await getByRole('button', { name: 'Browse feedpacks' }).click();
  await getByRole('button', { name: /DevSecOps Watch.*Testing sources/ }).click();

  // Act
  await getByRole('button', { name: 'Install' }).click();

  // Assert
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('feedpacks:install', expect.anything()));
  await expect.element(getByRole('list', { name: 'Feeds in workspace' })).toBeInTheDocument();
  await expect.element(getByText('Fetching sources')).not.toBeInTheDocument();
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

const MOD = navigator.userAgent.includes('Mac') ? 'Meta' : 'Control';

test('hovering a workspace icon shows its name and shortcut', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  const { getByRole } = await renderApp('/workspace/1');
  // React Aria opens hover tooltips only once it has seen a pointer interaction.
  await getByRole('img', { name: 'Monfil' }).click();

  // Act
  await getByRole('link', { name: 'CI/CD watch' }).hover();

  // Assert
  await expect.element(getByRole('tooltip')).toBeInTheDocument();
  expect(getByRole('tooltip').element().textContent).toMatch(/^CI\/CD watch (⌘|Ctrl\+)2$/);
});

test('the modifier and a digit open the workspace at that position', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  feedsByWorkspace = { 2: [createFeed({ id: 2, title: 'Pack feed', workspaceId: 2 })] };
  const { getByRole, getByText } = await renderApp('/workspace/1');
  await expect.element(getByRole('link', { name: 'CI/CD watch' })).toBeInTheDocument();

  // Act
  await userEvent.keyboard(`{${MOD}>}2{/${MOD}}`);

  // Assert
  await expect.element(getByText('Pack feed', { exact: true })).toBeInTheDocument();
});

function railNames(container: HTMLElement): string[] {
  return [...container.querySelectorAll('[aria-label="Workspaces"] a')].map((link) => link.getAttribute('aria-label') ?? '');
}

test('dragging a workspace icon onto the top of another moves it there', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' }), createWorkspace({ id: 3, name: 'Security' })];
  const { getByRole, container } = await renderApp('/workspace/1');
  await expect.element(getByRole('link', { name: 'Security' })).toBeInTheDocument();

  // Act
  await userEvent.dragAndDrop(getByRole('link', { name: 'Security' }), getByRole('link', { name: 'Home' }), { targetPosition: { x: 18, y: 2 } });

  // Assert
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('workspaces:reorder', { orderedIds: [3, 1, 2] }));
  await vi.waitFor(() => expect(railNames(container)).toEqual(['Security', 'Home', 'CI/CD watch']));
});

test('the drag handle moves a workspace with the keyboard', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' }), createWorkspace({ id: 3, name: 'Security' })];
  const { getByRole, container } = await renderApp('/workspace/1');
  await expect.element(getByRole('button', { name: 'Move Home' })).toBeInTheDocument();
  (getByRole('button', { name: 'Move Home' }).element() as HTMLElement).focus();

  // Act
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('{ArrowDown}');
  await userEvent.keyboard('{Enter}');

  // Assert
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('workspaces:reorder', { orderedIds: [2, 1, 3] }));
  await vi.waitFor(() => expect(railNames(container)).toEqual(['CI/CD watch', 'Home', 'Security']));
});

test('dropping a workspace back where it was saves nothing', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  const { getByRole } = await renderApp('/workspace/1');
  await expect.element(getByRole('button', { name: 'Move Home' })).toBeInTheDocument();
  (getByRole('button', { name: 'Move Home' }).element() as HTMLElement).focus();

  // Act
  await userEvent.keyboard('{Enter}');
  await expect.element(getByRole('button', { name: 'Insert between Home and CI/CD watch' })).toHaveFocus();
  await userEvent.keyboard('{Enter}');

  // Assert
  await expect.element(getByRole('button', { name: 'Insert between Home and CI/CD watch' })).not.toBeInTheDocument();
  expect(invokeMock).not.toHaveBeenCalledWith('workspaces:reorder', expect.anything());
});

test('the shortcut digits follow the new workspace order', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  feedsByWorkspace = { 2: [createFeed({ id: 2, title: 'Pack feed', workspaceId: 2 })] };
  const { getByRole, getByText } = await renderApp('/workspace/1');
  await userEvent.dragAndDrop(getByRole('link', { name: 'CI/CD watch' }), getByRole('link', { name: 'Home' }), { targetPosition: { x: 18, y: 2 } });
  await vi.waitFor(() => expect(invokeMock).toHaveBeenCalledWith('workspaces:reorder', { orderedIds: [2, 1] }));

  // Act
  await userEvent.keyboard(`{${MOD}>}1{/${MOD}}`);

  // Assert
  await expect.element(getByText('Pack feed', { exact: true })).toBeInTheDocument();
});

test('pressing Enter on a focused workspace row opens it', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  feedsByWorkspace = { 2: [createFeed({ id: 2, title: 'Pack feed', workspaceId: 2 })] };
  const { getByRole, getByText } = await renderApp('/workspace/1');
  await expect.element(getByRole('row', { name: 'CI/CD watch' })).toBeInTheDocument();
  (getByRole('row', { name: 'CI/CD watch' }).element() as HTMLElement).focus();

  // Act
  await userEvent.keyboard('{Enter}');

  // Assert
  await expect.element(getByText('Pack feed', { exact: true })).toBeInTheDocument();
});

test('marks the open workspace as the current page, also while reading one of its articles', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];

  // Act
  const workspacePage = await renderApp('/workspace/2');
  await expect.element(workspacePage.getByRole('link', { name: 'CI/CD watch' })).toHaveAttribute('aria-current', 'page');
  await expect.element(workspacePage.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  await workspacePage.unmount();
  const readerPage = await renderApp('/workspace/2/reader/5');

  // Assert
  await expect.element(readerPage.getByRole('link', { name: 'CI/CD watch' })).toHaveAttribute('aria-current', 'page');
  await expect.element(readerPage.getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
});

test('moves the current page mark to the workspace that was opened', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  const { getByRole } = await renderApp('/workspace/1');
  await expect.element(getByRole('link', { name: 'Home' })).toHaveAttribute('aria-current', 'page');

  // Act
  await getByRole('link', { name: 'CI/CD watch' }).click();

  // Assert
  await expect.element(getByRole('link', { name: 'CI/CD watch' })).toHaveAttribute('aria-current', 'page');
  await expect.element(getByRole('link', { name: 'Home' })).not.toHaveAttribute('aria-current');
  await expect.element(getByRole('link', { name: 'CI/CD watch' })).toHaveClass('ring-2');
  await expect.element(getByRole('link', { name: 'Home' })).not.toHaveClass('ring-2');
});

test('only the first nine workspaces get a shortcut', async () => {
  // Arrange
  workspaces = Array.from({ length: 10 }, (_, index) => createWorkspace({ id: index + 1, name: `Space ${index + 1}` }));
  const { getByRole } = await renderApp('/workspace/1');
  await getByRole('img', { name: 'Monfil' }).click();

  // Act
  await getByRole('link', { name: 'Space 10' }).hover();

  // Assert
  await expect.element(getByRole('tooltip')).toBeInTheDocument();
  expect(getByRole('tooltip').element().textContent).toBe('Space 10');
});

test('shows the new workspace order before the save finishes', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' }), createWorkspace({ id: 3, name: 'Security' })];
  reorderResponse = new Promise(() => undefined);
  const { getByRole, container } = await renderApp('/workspace/1');
  await expect.element(getByRole('link', { name: 'Security' })).toBeInTheDocument();

  // Act
  await userEvent.dragAndDrop(getByRole('link', { name: 'Security' }), getByRole('link', { name: 'Home' }), { targetPosition: { x: 18, y: 2 } });

  // Assert
  await vi.waitFor(() => expect(railNames(container)).toEqual(['Security', 'Home', 'CI/CD watch']));
});

test('puts the workspaces back in their stored order when the save fails', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  let failSave: (result: Result<void, UpdateWorkspaceError>) => void = () => undefined;
  reorderResponse = new Promise((resolve) => {
    failSave = resolve;
  });
  const { getByRole, container } = await renderApp('/workspace/1');
  await expect.element(getByRole('link', { name: 'CI/CD watch' })).toBeInTheDocument();
  await userEvent.dragAndDrop(getByRole('link', { name: 'CI/CD watch' }), getByRole('link', { name: 'Home' }), { targetPosition: { x: 18, y: 2 } });
  await vi.waitFor(() => expect(railNames(container)).toEqual(['CI/CD watch', 'Home']));

  // Act
  failSave({ success: false, error: { name: 'DB_ERROR', message: 'The database is locked.' } });

  // Assert
  await vi.waitFor(() => expect(railNames(container)).toEqual(['Home', 'CI/CD watch']));
});

test('highlights only the drop line the workspace would land on', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' }), createWorkspace({ id: 3, name: 'Security' })];
  const { getByRole } = await renderApp('/workspace/1');
  await expect.element(getByRole('button', { name: 'Move Home' })).toBeInTheDocument();
  (getByRole('button', { name: 'Move Home' }).element() as HTMLElement).focus();

  // Act
  await userEvent.keyboard('{Enter}');
  await userEvent.keyboard('{ArrowDown}');

  // Assert
  const line = (name: string) => getByRole('button', { name }).element().closest('[role="row"]');
  await expect.element(getByRole('button', { name: 'Insert between CI/CD watch and Security' })).toHaveFocus();
  expect(line('Insert between CI/CD watch and Security')).toHaveClass('h-0.5', 'bg-brand-solid');
  expect(line('Insert after Security')).not.toHaveClass('bg-brand-solid');
  await userEvent.keyboard('{Escape}');
});

test('the quick switcher filters workspaces by name and opens the chosen one', async () => {
  // Arrange
  workspaces = [createWorkspace({ id: 1, name: 'Home' }), createWorkspace({ id: 2, name: 'CI/CD watch' }), createWorkspace({ id: 3, name: 'Security' })];
  feedsByWorkspace = { 3: [createFeed({ id: 3, title: 'Security feed', workspaceId: 3 })] };
  const { getByRole, getByText } = await renderApp('/workspace/1');
  await expect.element(getByRole('link', { name: 'Security' })).toBeInTheDocument();

  // Act
  await userEvent.keyboard(`{${MOD}>}k{/${MOD}}`);
  await userEvent.keyboard('secu');
  await expect.element(getByRole('option', { name: /CI\/CD watch/ })).not.toBeInTheDocument();
  await userEvent.keyboard('{Enter}');

  // Assert
  await expect.element(getByText('Security feed', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('dialog', { name: 'Switch workspace' })).not.toBeInTheDocument();
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

test('an open edit dialog retargets to another workspace', async () => {
  // Arrange
  workspaces = [
    createWorkspace({ id: 2, name: 'CI/CD watch', icon: 'Terminal', color: '#3b82f6' }),
    createWorkspace({ id: 3, name: 'Design watch', icon: 'Rocket02', color: '#ef4444' }),
  ];
  const { getByRole } = await renderApp('/workspace/2');
  editWorkspaceRequestedHandler?.(2);
  await expect.element(getByRole('textbox', { name: 'Name' })).toHaveValue('CI/CD watch');

  // Act
  editWorkspaceRequestedHandler?.(3);

  // Assert
  await expect.element(getByRole('textbox', { name: 'Name' })).toHaveValue('Design watch');
  await expect.element(getByRole('button', { name: 'Rocket02' })).toHaveAttribute('aria-pressed', 'true');
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
