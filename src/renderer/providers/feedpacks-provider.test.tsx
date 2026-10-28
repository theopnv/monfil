// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useFeedpackCatalog, useFeedpackPreview, useInstallFeedpack } from './feedpacks-provider';
import { uiKeys } from '../lib/ipc-bridge';
import { queryKeys } from '../lib/queries';
import { HOME_WORKSPACE_ID, type FeedpackInstallTarget } from '../../shared/contracts';

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

describe('useInstallFeedpack', () => {
  const target: FeedpackInstallTarget = { kind: 'new-workspace', name: 'News', icon: 'globe', color: 'blue' };

  test('sends the slug and target, flags the new workspace as refreshing and refreshes what the install changed', async () => {
    // Arrange
    const summary = { success: true, data: { workspaceId: 5, imported: 12, skipped: [], failed: [] } };
    invokeImpl = () => Promise.resolve(summary);
    const { result, queryClient } = await renderProviderHook(useInstallFeedpack);

    // Act
    const returned = await result.current('tech-news', target);

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('feedpacks:install', { slug: 'tech-news', target });
    expect(returned).toEqual(summary);
    expect(queryClient.getQueryData(uiKeys.feedpackRefreshing(5))).toBe(true);
    expect(invalidatedQueries(queryClient)).toEqual(['categories', 'feeds', 'river', 'workspaces']);
  });

  test('does not flag the workspace as refreshing when nothing was imported', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve({ success: true, data: { workspaceId: 5, imported: 0, skipped: [], failed: [] } });
    const { result, queryClient } = await renderProviderHook(useInstallFeedpack);

    // Act
    await result.current('tech-news', target);

    // Assert
    expect(queryClient.getQueryData(uiKeys.feedpackRefreshing(5))).toBeUndefined();
    expect(invalidatedQueries(queryClient)).toEqual(['categories', 'feeds', 'river', 'workspaces']);
  });

  test('gives back the error and changes no cache when the install fails', async () => {
    // Arrange
    const failure = { success: false, error: { name: 'DB_ERROR', message: 'disk full' } };
    invokeImpl = () => Promise.resolve(failure);
    const { result, queryClient } = await renderProviderHook(useInstallFeedpack);

    // Act
    const returned = await result.current('tech-news', target);

    // Assert
    expect(returned).toEqual(failure);
    expect(invalidatedQueries(queryClient)).toEqual([]);
    expect(queryClient.getQueryData(uiKeys.feedpackRefreshing(5))).toBeUndefined();
  });
});

describe('useFeedpackPreview', () => {
  test('asks for the preview of the slug and gives back the result', async () => {
    // Arrange
    const preview = { success: true, data: { slug: 'tech-news', feeds: [] } };
    invokeImpl = () => Promise.resolve(preview);
    const { result } = await renderProviderHook(useFeedpackPreview);

    // Act
    const returned = await result.current('tech-news');

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('feedpacks:preview', { slug: 'tech-news' });
    expect(returned).toEqual(preview);
  });
});

describe('useFeedpackCatalog', () => {
  test('loads nothing while disabled', async () => {
    // Arrange
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>;

    // Act
    await renderHook(() => useFeedpackCatalog(false), { wrapper });
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Assert
    expect(window.electron.ipcRenderer.invoke).not.toHaveBeenCalled();
  });

  test('loads the catalog once when enabled and keeps it for later mounts', async () => {
    // Arrange
    const catalog = { success: true, data: { packs: [] } };
    invokeImpl = () => Promise.resolve(catalog);
    const queryClient = new QueryClient();
    const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
    const first = await renderHook(() => useFeedpackCatalog(true), { wrapper });
    await vi.waitFor(() => {
      expect(first.result.current.data).toEqual(catalog);
    });
    await first.unmount();

    // Act
    const second = await renderHook(() => useFeedpackCatalog(true), { wrapper });

    // Assert
    expect(second.result.current.data).toEqual(catalog);
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledTimes(1);
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('feedpacks:list', undefined);
  });
});
