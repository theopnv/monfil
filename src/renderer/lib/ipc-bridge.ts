// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback, useEffect } from 'react';
import { ipc } from '@/lib/ipc-client';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { RiverPage } from '../../shared/contracts';
import { patchRiverRows, queryKeys } from './queries';

export const uiKeys = {
  deleteFeedRequestedId: ['ui', 'delete-feed-requested'] as const,
  renameCategoryRequestedId: ['ui', 'rename-category-requested'] as const,
  deleteCategoryRequestedId: ['ui', 'delete-category-requested'] as const,
  editWorkspaceRequestedId: ['ui', 'edit-workspace-requested'] as const,
  exportWorkspaceRequestedId: ['ui', 'export-workspace-requested'] as const,
  deleteWorkspaceRequestedId: ['ui', 'delete-workspace-requested'] as const,
  pendingRefreshFeedIds: ['ui', 'pending-refresh-feed-ids'] as const,
  appliedRefreshVersion: ['ui', 'applied-refresh-version'] as const,
  feedpackRefreshing: (workspaceId: number) => ['ui', 'feedpack-refreshing', workspaceId] as const,
};

/**
 * The single subscriber for every main -> renderer push. Mount once, at the root of the app.
 * Every inbound event becomes a cache write; no other component calls `ipcRenderer.on`.
 */
export function useIpcBridge(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribers = [
      // Record which feeds gained items, never the rows themselves: content must not move under a
      // user who is mid-scroll. The Refresh pill (`useHasPendingRefresh`) is how the user opts into
      // loading them. Edits and removals alone do not raise it, since they add no card at the top.
      //
      // Only raise it when a river is already rendered to protect. At launch, the very first
      // `items:query` fetch can still be in flight when this push lands; that fetch has nothing
      // loaded yet to disturb, so it just shows whatever is current once it resolves. Raising the
      // pill anyway would leave it stuck on screen after that fetch already caught up on its own,
      // since the click has nothing left to do.
      ipc.on('feeds:refreshed', (summary) => {
        const feedIdsWithNewItems = summary.perFeed.filter((feed) => feed.inserted > 0).map((feed) => feed.feedId);
        const hasRenderedRiver = queryClient.getQueriesData<InfiniteData<RiverPage>>({ queryKey: ['river'] })
          .some(([, data]) => data !== undefined);
        if (summary.applyImmediately) {
          queryClient.setQueryData<number[]>(uiKeys.pendingRefreshFeedIds, []);
          queryClient.setQueryData<number>(uiKeys.appliedRefreshVersion, (version) => (version ?? 0) + 1);
          void queryClient.invalidateQueries({ queryKey: ['river'] });
        } else if (feedIdsWithNewItems.length > 0 && hasRenderedRiver) {
          queryClient.setQueryData<number[]>(uiKeys.pendingRefreshFeedIds, (prev = []) => [...new Set([...prev, ...feedIdsWithNewItems])]);
        }
        void queryClient.invalidateQueries({ queryKey: queryKeys.appInfo });
        void queryClient.invalidateQueries({ queryKey: ['feeds'] });
      }),

      ipc.on('feeds:item-image-fetched', ({ itemId, image }) => {
        queryClient.setQueriesData<InfiniteData<RiverPage>>(
          { queryKey: ['river'] },
          (data) => (data ? patchRiverRows(data, new Set([itemId]), (row) => ({ ...row, image })) : data),
        );
      }),

      ipc.on('feeds:delete-feed-requested', (feedId) => {
        queryClient.setQueryData(uiKeys.deleteFeedRequestedId, feedId);
      }),

      ipc.on('feeds:rename-category-requested', (categoryId) => {
        queryClient.setQueryData(uiKeys.renameCategoryRequestedId, categoryId);
      }),

      ipc.on('feeds:delete-category-requested', (categoryId) => {
        queryClient.setQueryData(uiKeys.deleteCategoryRequestedId, categoryId);
      }),

      ipc.on('workspaces:edit-requested', (workspaceId) => {
        queryClient.setQueryData(uiKeys.editWorkspaceRequestedId, workspaceId);
      }),

      ipc.on('workspaces:export-requested', (workspaceId) => {
        queryClient.setQueryData(uiKeys.exportWorkspaceRequestedId, workspaceId);
      }),

      ipc.on('workspaces:delete-requested', (workspaceId) => {
        queryClient.setQueryData(uiKeys.deleteWorkspaceRequestedId, workspaceId);
      }),

      ipc.on('app:update-state-changed', (state) => {
        queryClient.setQueryData(queryKeys.updateState, state);
      }),

      ipc.on('feedpacks:install-finished', ({ workspaceId }) => {
        queryClient.setQueryData(uiKeys.feedpackRefreshing(workspaceId), false);
        void queryClient.invalidateQueries({ queryKey: ['feeds', workspaceId] });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient]);
}

/**
 * Whether a background refresh stored new items in any of the given feeds since the river last loaded them.
 * @param feedIds the feeds the current river shows
 */
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
  return useCallback(() => {
    queryClient.setQueryData<number[]>(uiKeys.pendingRefreshFeedIds, []);
    queryClient.setQueryData<number>(uiKeys.appliedRefreshVersion, (version) => (version ?? 0) + 1);
    void queryClient.invalidateQueries({ queryKey: ['river'] });
  }, [queryClient]);
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

/** The feed id a "Delete feed" context-menu click asked to confirm, or `null` when none is pending. */
export function useDeleteFeedRequestedId(): number | null {
  // `null`, not `undefined`: React Query treats an `undefined` query result as an error.
  const { data } = useQuery({
    queryKey: uiKeys.deleteFeedRequestedId,
    queryFn: (): number | null => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

export function useClearDeleteFeedRequest(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.setQueryData(uiKeys.deleteFeedRequestedId, null);
  }, [queryClient]);
}

/** The category id a "Rename" context-menu click asked to edit, or `null` when none is pending. */
export function useRenameCategoryRequestedId(): number | null {
  const { data } = useQuery({
    queryKey: uiKeys.renameCategoryRequestedId,
    queryFn: (): number | null => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

export function useClearRenameCategoryRequest(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.setQueryData(uiKeys.renameCategoryRequestedId, null);
  }, [queryClient]);
}

/** The category id a "Delete" context-menu click asked to confirm, or `null` when none is pending. */
export function useDeleteCategoryRequestedId(): number | null {
  const { data } = useQuery({
    queryKey: uiKeys.deleteCategoryRequestedId,
    queryFn: (): number | null => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

export function useClearDeleteCategoryRequest(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.setQueryData(uiKeys.deleteCategoryRequestedId, null);
  }, [queryClient]);
}

/** The workspace id an "Edit workspace" context-menu click asked to edit, or `null` when none is pending. */
export function useEditWorkspaceRequestedId(): number | null {
  const { data } = useQuery({
    queryKey: uiKeys.editWorkspaceRequestedId,
    queryFn: (): number | null => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

export function useClearEditWorkspaceRequest(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.setQueryData(uiKeys.editWorkspaceRequestedId, null);
  }, [queryClient]);
}

/** The workspace id an "Export as OPML" context-menu click asked to export, or `null` when none is pending. */
export function useExportWorkspaceRequestedId(): number | null {
  const { data } = useQuery({
    queryKey: uiKeys.exportWorkspaceRequestedId,
    queryFn: (): number | null => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

export function useClearExportWorkspaceRequest(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.setQueryData(uiKeys.exportWorkspaceRequestedId, null);
  }, [queryClient]);
}

/** The workspace id a "Delete workspace" context-menu click asked to confirm, or `null` when none is pending. */
export function useDeleteWorkspaceRequestedId(): number | null {
  const { data } = useQuery({
    queryKey: uiKeys.deleteWorkspaceRequestedId,
    queryFn: (): number | null => null,
    initialData: null,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

export function useClearDeleteWorkspaceRequest(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.setQueryData(uiKeys.deleteWorkspaceRequestedId, null);
  }, [queryClient]);
}
