// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback, useEffect } from 'react';
import { ipc } from '@/lib/ipc-client';
import { useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import type { MenuActions, MenuKind } from '../../shared/channels';
import type { RiverPage } from '../../shared/contracts';
import { patchRiverRows, queryKeys } from './queries';

export const uiKeys = {
  deleteFeedRequestedId: ['ui', 'delete-feed-requested'] as const,
  moveFeedRequestedId: ['ui', 'move-feed-requested'] as const,
  renameCategoryRequestedId: ['ui', 'rename-category-requested'] as const,
  deleteCategoryRequestedId: ['ui', 'delete-category-requested'] as const,
  editWorkspaceRequestedId: ['ui', 'edit-workspace-requested'] as const,
  exportWorkspaceRequestedId: ['ui', 'export-workspace-requested'] as const,
  deleteWorkspaceRequestedId: ['ui', 'delete-workspace-requested'] as const,
  pendingRefreshFeedIds: ['ui', 'pending-refresh-feed-ids'] as const,
  appliedRefreshVersion: ['ui', 'applied-refresh-version'] as const,
  feedpackRefreshing: (workspaceId: number) => ['ui', 'feedpack-refreshing', workspaceId] as const,
};

type MenuRequestName = { [K in MenuKind]: `${K}.${MenuActions[K]}` }[MenuKind];

const menuRequestKeys: Record<MenuRequestName, readonly unknown[]> = {
  'feed.move': uiKeys.moveFeedRequestedId,
  'feed.delete': uiKeys.deleteFeedRequestedId,
  'category.rename': uiKeys.renameCategoryRequestedId,
  'category.delete': uiKeys.deleteCategoryRequestedId,
  'workspace.edit': uiKeys.editWorkspaceRequestedId,
  'workspace.export': uiKeys.exportWorkspaceRequestedId,
  'workspace.delete': uiKeys.deleteWorkspaceRequestedId,
};

/** Loads what a refresh stored into every river at once, and clears the pill that offered it. */
export function applyRefreshNow(queryClient: QueryClient): void {
  queryClient.setQueryData<number[]>(uiKeys.pendingRefreshFeedIds, []);
  queryClient.setQueryData<number>(uiKeys.appliedRefreshVersion, (version) => (version ?? 0) + 1);
  void queryClient.invalidateQueries({ queryKey: queryKeys.riverAll });
}

/**
 * The single subscriber for every main -> renderer push. Mount once, at the root of the app.
 * Every inbound event becomes a cache write; no other component calls `ipcRenderer.on`.
 */
export function usePushEvents(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribers = [
      // Record which feeds gained items, never the rows: content must not move under a mid-scroll user, who
      // opts in through the Refresh pill. Raise it only when a river is already rendered: at launch the first
      // `items:query` can still be in flight, and a pill raised then would stay stuck once that fetch has caught up.
      ipc.on('feeds:refreshed', (summary) => {
        const feedIdsWithNewItems = summary.perFeed.filter((feed) => feed.inserted > 0).map((feed) => feed.feedId);
        const hasRenderedRiver = queryClient.getQueriesData<InfiniteData<RiverPage>>({ queryKey: queryKeys.riverAll })
          .some(([, data]) => data !== undefined);
        if (summary.applyImmediately) {
          applyRefreshNow(queryClient);
        } else if (feedIdsWithNewItems.length > 0 && hasRenderedRiver) {
          queryClient.setQueryData<number[]>(uiKeys.pendingRefreshFeedIds, (prev = []) => [...new Set([...prev, ...feedIdsWithNewItems])]);
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.appInfo });
        void queryClient.invalidateQueries({ queryKey: queryKeys.feedsAll });
      }),

      ipc.on('feeds:item-image-fetched', ({ itemId, image }) => {
        queryClient.setQueriesData<InfiniteData<RiverPage>>(
          { queryKey: queryKeys.riverAll },
          (data) => (data ? patchRiverRows(data, new Set([itemId]), (row) => ({ ...row, image })) : data),
        );
      }),

      ipc.on('menu:action', (menu) => {
        queryClient.setQueryData(menuRequestKeys[`${menu.kind}.${menu.action}` as MenuRequestName], menu.id);
      }),

      ipc.on('app:update-state-changed', (state) => {
        queryClient.setQueryData(queryKeys.updateState, state);
      }),

      ipc.on('feedpacks:install-finished', ({ workspaceId }) => {
        queryClient.setQueryData(uiKeys.feedpackRefreshing(workspaceId), false);
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds(workspaceId) });
        void queryClient.invalidateQueries({ queryKey: queryKeys.riverAll });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient]);
}

/** Whether a background refresh stored new items in any of the given feeds since the river last loaded them. */
export function useHasPendingRefresh(feedIds: ReadonlySet<number>): boolean {
  const { data } = useQuery<number[]>({
    queryKey: uiKeys.pendingRefreshFeedIds,
    queryFn: () => [],
    initialData: [],
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data.some((feedId) => feedIds.has(feedId));
}

/** Loads the new items a background refresh stored into every river, without fetching the feeds again. */
export function useApplyPendingRefresh(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => applyRefreshNow(queryClient), [queryClient]);
}

export function useAppliedRefreshVersion(): number {
  const { data } = useQuery({ queryKey: uiKeys.appliedRefreshVersion, queryFn: () => 0, initialData: 0, staleTime: Infinity, gcTime: Infinity });
  return data;
}

export function useFeedpackRefreshing(workspaceId: number | undefined): boolean {
  const { data } = useQuery({
    queryKey: uiKeys.feedpackRefreshing(workspaceId ?? -1),
    queryFn: (): boolean => false,
    initialData: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

/**
 * A native menu click leaves the id it was about in the query cache until the dialog that answers it clears it.
 * `null`, not `undefined`, is the empty value: React Query treats an `undefined` query result as an error.
 */
function createRequestSlot(key: readonly unknown[]) {
  function useRequestedId(): number | null {
    const { data } = useQuery({ queryKey: key, queryFn: (): number | null => null, initialData: null, staleTime: Infinity, gcTime: Infinity });
    return data;
  }

  function useClearRequest(): () => void {
    const queryClient = useQueryClient();
    return useCallback(() => {
      queryClient.setQueryData(key, null);
    }, [queryClient]);
  }

  return { useRequestedId, useClearRequest };
}

export const { useRequestedId: useDeleteFeedRequestedId, useClearRequest: useClearDeleteFeedRequest } = createRequestSlot(uiKeys.deleteFeedRequestedId);
export const { useRequestedId: useMoveFeedRequestedId, useClearRequest: useClearMoveFeedRequest } = createRequestSlot(uiKeys.moveFeedRequestedId);
export const { useRequestedId: useRenameCategoryRequestedId, useClearRequest: useClearRenameCategoryRequest } = createRequestSlot(uiKeys.renameCategoryRequestedId);
export const { useRequestedId: useDeleteCategoryRequestedId, useClearRequest: useClearDeleteCategoryRequest } = createRequestSlot(uiKeys.deleteCategoryRequestedId);
export const { useRequestedId: useEditWorkspaceRequestedId, useClearRequest: useClearEditWorkspaceRequest } = createRequestSlot(uiKeys.editWorkspaceRequestedId);
export const { useRequestedId: useExportWorkspaceRequestedId, useClearRequest: useClearExportWorkspaceRequest } = createRequestSlot(uiKeys.exportWorkspaceRequestedId);
export const { useRequestedId: useDeleteWorkspaceRequestedId, useClearRequest: useClearDeleteWorkspaceRequest } = createRequestSlot(uiKeys.deleteWorkspaceRequestedId);
