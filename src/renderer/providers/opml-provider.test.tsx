// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import { useExportOpml, useImportOpml } from './opml-provider';
import { queryKeys } from '../lib/queries';
import { HOME_WORKSPACE_ID, type ImportOpmlTarget } from '../../shared/contracts';

const SEEDED_KEYS = {
  feeds: queryKeys.feeds(HOME_WORKSPACE_ID),
  categories: queryKeys.categories(HOME_WORKSPACE_ID),
  river: queryKeys.river({ workspaceId: HOME_WORKSPACE_ID }),
  workspaces: queryKeys.workspaces,
  unrelated: queryKeys.appInfo,
};

let invokeImpl: (channel: string, arg: unknown) => Promise<unknown>;

beforeEach(() => {
  invokeImpl = () => Promise.resolve({ success: true, data: undefined });
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

describe('useImportOpml', () => {
  const target: ImportOpmlTarget = { kind: 'merge-workspace', workspaceId: 2 };

  test('sends the target and refreshes the workspaces, feeds, categories and rivers', async () => {
    // Arrange
    const summary = { success: true, data: { workspaceId: 2, imported: 3, skipped: [], failed: [] } };
    invokeImpl = () => Promise.resolve(summary);
    const { result, queryClient } = await renderProviderHook(useImportOpml);

    // Act
    const returned = await result.current(target);

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('opml:import', { target });
    expect(returned).toEqual(summary);
    expect(invalidatedQueries(queryClient)).toEqual(['categories', 'feeds', 'river', 'workspaces']);
  });

  test('gives back the error and refreshes nothing when the import fails', async () => {
    // Arrange
    const failure = { success: false, error: { name: 'CANCELLED', message: 'cancelled' } };
    invokeImpl = () => Promise.resolve(failure);
    const { result, queryClient } = await renderProviderHook(useImportOpml);

    // Act
    const returned = await result.current(target);

    // Assert
    expect(returned).toEqual(failure);
    expect(invalidatedQueries(queryClient)).toEqual([]);
  });
});

describe('useExportOpml', () => {
  test('exports the given workspace and gives back the result', async () => {
    // Arrange
    const failure = { success: false, error: { name: 'NO_FEEDS', message: 'empty' } };
    invokeImpl = () => Promise.resolve(failure);
    const { result, queryClient } = await renderProviderHook(useExportOpml);

    // Act
    const returned = await result.current(2);

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('opml:export', { workspaceId: 2 });
    expect(returned).toEqual(failure);
    expect(invalidatedQueries(queryClient)).toEqual([]);
  });
});
