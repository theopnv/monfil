// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import {
  useActiveWorkspace, useActiveWorkspaceId, useCreateWorkspace, useDeleteWorkspace, useMoveFeedToWorkspace, useReorderWorkspaces,
  useUpdateWorkspace, useWorkspaces,
} from './workspace-provider';
import { queryKeys } from '../lib/queries';
import { HOME_WORKSPACE_ID, type WorkspaceSummary } from '../../shared/contracts';

const SEEDED_KEYS = {
  feeds: queryKeys.feeds(HOME_WORKSPACE_ID),
  categories: queryKeys.categories(HOME_WORKSPACE_ID),
  river: queryKeys.river({ workspaceId: HOME_WORKSPACE_ID }),
  workspaces: queryKeys.workspaces,
  unrelated: queryKeys.appInfo,
};

let invokeImpl: (channel: string, arg: unknown) => Promise<unknown>;

beforeEach(() => {
  invokeImpl = () => Promise.resolve([]);
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn((channel: string, arg: unknown) => invokeImpl(channel, arg)),
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

function workspace(id: number, name = `Workspace ${id}`): WorkspaceSummary {
  return { id, name, icon: 'home', color: 'blue', position: id, source_slug: undefined, source_version: undefined, installed_at: undefined, hasUnread: false };
}

async function renderProviderHook<T>(hook: () => T) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of Object.values(SEEDED_KEYS)) {
    queryClient.setQueryData(key, []);
  }
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const rendered = await renderHook(hook, { wrapper });
  return { queryClient, ...rendered };
}

function invalidatedQueries(queryClient: QueryClient): string[] {
  return Object.entries(SEEDED_KEYS)
    .filter(([, key]) => queryClient.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort();
}

async function runHook<T extends (...args: never[]) => Promise<unknown>>(hook: () => T, call: (action: T) => Promise<unknown>) {
  const { result, queryClient } = await renderProviderHook(hook);
  const returned = await call(result.current);
  return { returned, queryClient };
}

const FAILURE = { success: false, error: { name: 'DB_ERROR', message: 'disk full' } } as const;

interface MutationCase {
  name: string;
  run: () => Promise<{ returned: unknown; queryClient: QueryClient }>;
  channel: string;
  payload: unknown;
  invalidates: string[];
}

const MUTATION_CASES: MutationCase[] = [
  {
    name: 'useCreateWorkspace',
    run: () => runHook(useCreateWorkspace, (create) => create({ name: 'Work', icon: 'briefcase', color: 'red' })),
    channel: 'workspaces:create',
    payload: { name: 'Work', icon: 'briefcase', color: 'red' },
    invalidates: ['workspaces'],
  },
  {
    name: 'useUpdateWorkspace',
    run: () => runHook(useUpdateWorkspace, (update) => update(2, { name: 'Play', color: 'green' })),
    channel: 'workspaces:update',
    payload: { workspaceId: 2, name: 'Play', color: 'green' },
    invalidates: ['workspaces'],
  },
  {
    name: 'useDeleteWorkspace',
    run: () => runHook(useDeleteWorkspace, (remove) => remove(2)),
    channel: 'workspaces:delete',
    payload: { workspaceId: 2 },
    invalidates: ['categories', 'feeds', 'river', 'workspaces'],
  },
  {
    name: 'useReorderWorkspaces',
    run: () => runHook(useReorderWorkspaces, (reorder) => reorder([3, 1, 2])),
    channel: 'workspaces:reorder',
    payload: { orderedIds: [3, 1, 2] },
    invalidates: ['workspaces'],
  },
  {
    name: 'useMoveFeedToWorkspace',
    run: () => runHook(useMoveFeedToWorkspace, (move) => move(9, 1, 2, 'Tech')),
    channel: 'feeds:move-to-workspace',
    payload: { feedId: 9, fromWorkspaceId: 1, toWorkspaceId: 2, categoryName: 'Tech' },
    invalidates: ['categories', 'feeds', 'river', 'workspaces'],
  },
];

describe.each(MUTATION_CASES)('$name', ({ run, channel, payload, invalidates }) => {
  test('sends the request and refreshes the queries it changed', async () => {
    // Arrange
    const success = { success: true, data: { id: 2 } };
    invokeImpl = () => Promise.resolve(success);

    // Act
    const { returned, queryClient } = await run();

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(channel, payload);
    expect(returned).toEqual(success);
    expect(invalidatedQueries(queryClient)).toEqual(invalidates);
  });

  test('returns the error and refreshes nothing when the request fails', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve(FAILURE);

    // Act
    const { returned, queryClient } = await run();

    // Assert
    expect(returned).toEqual(FAILURE);
    expect(invalidatedQueries(queryClient)).toEqual([]);
  });
});

describe('workspace queries', () => {
  test('useWorkspaces lists the workspaces in rail order and is empty before they load', async () => {
    // Arrange
    const loaded = [workspace(1), workspace(2)];
    invokeImpl = (channel) => Promise.resolve(channel === 'workspaces:list' ? loaded : []);
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    // Act
    const { result } = await renderHook(useWorkspaces, { wrapper });

    // Assert
    expect(result.current).toEqual([]);
    await vi.waitFor(() => {
      expect(result.current).toEqual(loaded);
    });
  });

  test('useActiveWorkspace is Home when no route sets a workspace', async () => {
    // Arrange
    invokeImpl = (channel) => Promise.resolve(channel === 'workspaces:list' ? [workspace(2), workspace(HOME_WORKSPACE_ID, 'Home')] : []);
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;

    // Act
    const { result } = await renderHook(() => ({ active: useActiveWorkspace(), id: useActiveWorkspaceId() }), { wrapper });

    // Assert
    expect(result.current.id).toBe(HOME_WORKSPACE_ID);
    expect(result.current.active).toBeUndefined();
    await vi.waitFor(() => {
      expect(result.current.active?.name).toBe('Home');
    });
  });
});
