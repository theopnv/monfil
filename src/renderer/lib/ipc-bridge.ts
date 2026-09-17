import { useCallback, useEffect } from 'react';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import type { RiverPage } from '../../preload/channels';
import { patchRiverRows } from './queries';

export const uiKeys = {
  deleteFeedRequestedId: ['ui', 'delete-feed-requested'] as const,
  renameCategoryRequestedId: ['ui', 'rename-category-requested'] as const,
  deleteCategoryRequestedId: ['ui', 'delete-category-requested'] as const,
  editWorkspaceRequestedId: ['ui', 'edit-workspace-requested'] as const,
  pendingRefreshCount: ['ui', 'pending-refresh-count'] as const,
};

/**
 * The single subscriber for every main -> renderer push. Mount once, at the root of the app.
 * Every inbound event becomes a cache write; no other component calls `ipcRenderer.on`.
 */
export function useIpcBridge(): void {
  const queryClient = useQueryClient();

  useEffect(() => {
    const unsubscribers = [
      // Insert counts only, never the rows themselves: content must not move under a user who is
      // mid-scroll. The pill (`usePendingRefreshCount`) is how the user opts into loading them.
      //
      // Only raise it when a river is already rendered to protect. At launch, the very first
      // `items:query` fetch can still be in flight when this push lands; that fetch has nothing
      // loaded yet to disturb, so it just shows whatever is current once it resolves. Raising the
      // pill anyway would leave it stuck on screen after that fetch already caught up on its own,
      // since the click has nothing left to do.
      window.electron.ipcRenderer.on('feeds:refreshed', (summary) => {
        const inserted = summary.perFeed.reduce((total, feed) => total + feed.inserted, 0);
        const hasRenderedRiver = queryClient.getQueriesData<InfiniteData<RiverPage>>({ queryKey: ['river'] })
          .some(([, data]) => data !== undefined);
        if (inserted > 0 && hasRenderedRiver) {
          queryClient.setQueryData<number>(uiKeys.pendingRefreshCount, (prev) => (prev ?? 0) + inserted);
        }
        void queryClient.invalidateQueries({ queryKey: ['feeds'] });
      }),

      window.electron.ipcRenderer.on('feeds:item-image-fetched', ({ itemId, image }) => {
        queryClient.setQueriesData<InfiniteData<RiverPage>>(
          { queryKey: ['river'] },
          (data) => (data ? patchRiverRows(data, new Set([itemId]), (row) => ({ ...row, image })) : data),
        );
      }),

      window.electron.ipcRenderer.on('feeds:delete-feed-requested', (feedId) => {
        queryClient.setQueryData(uiKeys.deleteFeedRequestedId, feedId);
      }),

      window.electron.ipcRenderer.on('feeds:rename-category-requested', (categoryId) => {
        queryClient.setQueryData(uiKeys.renameCategoryRequestedId, categoryId);
      }),

      window.electron.ipcRenderer.on('feeds:delete-category-requested', (categoryId) => {
        queryClient.setQueryData(uiKeys.deleteCategoryRequestedId, categoryId);
      }),

      window.electron.ipcRenderer.on('workspaces:edit-requested', (workspaceId) => {
        queryClient.setQueryData(uiKeys.editWorkspaceRequestedId, workspaceId);
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [queryClient]);
}

/** How many items a background refresh has inserted since the pill was last cleared. */
export function usePendingRefreshCount(): number {
  const { data } = useQuery({
    queryKey: uiKeys.pendingRefreshCount,
    queryFn: () => 0,
    initialData: 0,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  return data;
}

export function useClearPendingRefreshCount(): () => void {
  const queryClient = useQueryClient();
  return useCallback(() => {
    queryClient.setQueryData(uiKeys.pendingRefreshCount, 0);
  }, [queryClient]);
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
