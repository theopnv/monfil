// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useSavedSearchActions, useSavedSearches } from './saved-searches-provider';
import { queryKeys } from '../lib/queries';
import { renderHookInWorkspace } from '../lib/test/render-hook-in-workspace';
import { HOME_WORKSPACE_ID, type SavedSearchList } from '../../shared/contracts';

const SEARCHES_KEY = queryKeys.searches(HOME_WORKSPACE_ID);
const FEEDS_KEY = queryKeys.feeds(HOME_WORKSPACE_ID);

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

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  queryClient.setQueryData(SEARCHES_KEY, { searches: [], hintExample: undefined } satisfies SavedSearchList);
  queryClient.setQueryData(FEEDS_KEY, []);
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  return { queryClient, wrapper };
}

describe('useSavedSearches', () => {
  test('is empty with no hint before the list loads, then gives the list of the active workspace', async () => {
    // Arrange
    const list: SavedSearchList = {
      searches: [{ id: 1, workspace_id: HOME_WORKSPACE_ID, name: 'Rust', query: 'rust', position: 0, created_at: 1, unreadCount: 2 }],
      hintExample: 'senior engineer',
    };
    invokeImpl = (channel) => Promise.resolve(channel === 'searches:list' ? list : []);
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

    // Act
    const { result } = await renderHook(useSavedSearches, { wrapper });

    // Assert
    expect(result.current).toEqual({ searches: [], hintExample: undefined });
    await vi.waitFor(() => {
      expect(result.current).toEqual(list);
    });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('searches:list', { workspaceId: HOME_WORKSPACE_ID });
  });
});

describe('useSavedSearchActions', () => {
  test.each([
    {
      name: 'create',
      call: (actions: ReturnType<typeof useSavedSearchActions>) => actions.create('Rust', 'rust'),
      channel: 'searches:create',
      payload: { workspaceId: HOME_WORKSPACE_ID, name: 'Rust', query: 'rust' },
    },
    {
      name: 'update',
      call: (actions: ReturnType<typeof useSavedSearchActions>) => actions.update(4, { name: 'Go', query: 'golang' }),
      channel: 'searches:update',
      payload: { searchId: 4, name: 'Go', query: 'golang' },
    },
    {
      name: 'remove',
      call: (actions: ReturnType<typeof useSavedSearchActions>) => actions.remove(4),
      channel: 'searches:delete',
      payload: { searchId: 4 },
    },
  ])('$name sends the request, refreshes only the saved searches and gives back the result', async ({ call, channel, payload }) => {
    // Arrange
    const success = { success: true, data: { id: 4 } };
    invokeImpl = () => Promise.resolve(success);
    const { queryClient, wrapper } = createWrapper();
    const { result } = await renderHook(useSavedSearchActions, { wrapper });

    // Act
    const returned = await call(result.current);

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(channel, payload);
    expect(returned).toEqual(success);
    expect(queryClient.getQueryState(SEARCHES_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(FEEDS_KEY)?.isInvalidated).toBe(false);
  });

  test('a refused request still gives back its error', async () => {
    // Arrange
    const failure = { success: false, error: { name: 'DUPLICATE_NAME', message: 'taken' } };
    invokeImpl = () => Promise.resolve(failure);
    const { wrapper } = createWrapper();
    const { result } = await renderHook(useSavedSearchActions, { wrapper });

    // Act
    const returned = await result.current.create('Rust', 'rust');

    // Assert
    expect(returned).toEqual(failure);
  });

  test('create and dismissHint act on the workspace that is active when they are called', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve({ success: true, data: undefined });
    const { result, goToWorkspace } = await renderHookInWorkspace(useSavedSearchActions);
    await goToWorkspace(3);

    // Act
    await result.current.create('Rust', 'rust');
    await result.current.dismissHint();

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('searches:create', { workspaceId: 3, name: 'Rust', query: 'rust' });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('searches:dismiss-hint', { workspaceId: 3 });
  });

  test('dismissHint dismisses the hint of the active workspace and refreshes the saved searches', async () => {
    // Arrange
    const { queryClient, wrapper } = createWrapper();
    const { result } = await renderHook(useSavedSearchActions, { wrapper });

    // Act
    await result.current.dismissHint();

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('searches:dismiss-hint', { workspaceId: HOME_WORKSPACE_ID });
    expect(queryClient.getQueryState(SEARCHES_KEY)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(FEEDS_KEY)?.isInvalidated).toBe(false);
  });
});
