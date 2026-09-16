import { useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import type { FeedCategory, FeedSummary, RiverPage } from "../../preload/channels";
import type { DeleteCategoryError, DeleteFeedError } from "../../main/db/crud/delete";
import type { AddFeedError, CreateCategoryError, NewFeedInput } from "../../main/db/crud/insert";
import type { UpdateCategoryError, UpdateFeedError } from "../../main/db/crud/update";
import type { Result } from "../../main/lib/utils";
import { categoriesQuery, feedsQuery, patchRiverRows, queryKeys, riverQuery, type RiverScope } from "../lib/queries";

export const useFeeds = (): FeedSummary[] => {
  const { data } = useQuery(feedsQuery());
  return data ?? [];
};

/** Every category, including ones with no feeds in them yet. */
export const useCategories = (): FeedCategory[] => {
  const { data } = useQuery(categoriesQuery());
  return data ?? [];
};

export const useRiver = (scope: RiverScope): UseInfiniteQueryResult<InfiniteData<RiverPage>> => useInfiniteQuery(riverQuery(scope));

export const useAddFeed = (): ((input: NewFeedInput) => Promise<Result<FeedSummary, AddFeedError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: NewFeedInput) => window.electron.ipcRenderer.invoke('feeds:submit-add-feed', input),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
        // A feed can be filed under a brand new category name (see CategoryPicker's "+ New
        // category"), which creates that category as a side effect.
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((input: NewFeedInput) => mutateAsync(input), [mutateAsync]);
};

export const useDeleteFeed = (): ((feedId: number) => Promise<Result<void, DeleteFeedError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (feedId: number) => window.electron.ipcRenderer.invoke('feeds:delete-feed', feedId),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((feedId: number) => mutateAsync(feedId), [mutateAsync]);
};

export const useSetShowInWorkspace = (): ((feedIds: number[], showInWorkspace: boolean) => Promise<Result<void, UpdateFeedError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: { feedIds: number[]; showInWorkspace: boolean }) => window.electron.ipcRenderer.invoke('feeds:set-show-in-workspace', variables),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((feedIds: number[], showInWorkspace: boolean) => mutateAsync({ feedIds, showInWorkspace }), [mutateAsync]);
};

export const useCreateCategory = (): ((name: string) => Promise<Result<FeedCategory, CreateCategoryError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (name: string) => window.electron.ipcRenderer.invoke('feeds:create-category', { name }),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((name: string) => mutateAsync(name), [mutateAsync]);
};

export const useRenameCategory = (): ((categoryId: number, name: string) => Promise<Result<FeedCategory, UpdateCategoryError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: { categoryId: number; name: string }) => window.electron.ipcRenderer.invoke('feeds:rename-category', variables),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((categoryId: number, name: string) => mutateAsync({ categoryId, name }), [mutateAsync]);
};

export const useDeleteCategory = (): ((categoryId: number, reassignTo: number) => Promise<Result<void, DeleteCategoryError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: { categoryId: number; reassignTo: number }) => window.electron.ipcRenderer.invoke('feeds:delete-category', variables),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
        void queryClient.invalidateQueries({ queryKey: queryKeys.categories });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((categoryId: number, reassignTo: number) => mutateAsync({ categoryId, reassignTo }), [mutateAsync]);
};

export const useMoveFeeds = (): ((feedIds: number[], categoryId: number) => Promise<Result<void, UpdateCategoryError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: { feedIds: number[]; categoryId: number }) => window.electron.ipcRenderer.invoke('feeds:move-feeds-to-category', variables),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((feedIds: number[], categoryId: number) => mutateAsync({ feedIds, categoryId }), [mutateAsync]);
};

interface FeedsRefresh {
  refreshNow: () => void;
  isRefreshing: boolean;
  refreshFailed: boolean;
}

export const useFeedsRefresh = (): FeedsRefresh => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => window.electron.ipcRenderer.invoke('feeds:refresh', undefined),
    onSuccess: () => {
      // A user-initiated refresh gets its content immediately; an automatic cycle's `feeds:refreshed`
      // push only raises the pill (see `useIpcBridge`), so it never moves the river under the user.
      void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
      void queryClient.invalidateQueries({ queryKey: ['river'] });
    },
    onError: (error: unknown) => {
      console.error('Error refreshing feeds:', error);
    },
  });

  return {
    refreshNow: () => mutation.mutate(),
    isRefreshing: mutation.isPending,
    refreshFailed: mutation.isError,
  };
};

interface ReadState {
  markRead: (id: number) => void;
  markAllRead: (ids: number[]) => void;
  toggleRead: (id: number, currentlyRead: boolean) => void;
}

interface ReadStateContext {
  // Keyed by item id rather than a whole-page snapshot: two of these mutations can be in flight at
  // once over the same page (one item each), and restoring a full snapshot taken before the second
  // one started would silently undo it. Restoring only the rows this mutation itself touched can't.
  previousReadAt: Map<number, string | undefined>;
}

/**
 * `onMutate` records each affected row's prior `readAt` before patching it in place; `onError`
 * restores exactly those rows, so a failed batch (or a batch racing another one) cannot lose an
 * item's prior state the way a hand-rolled "flip everything back" rollback would. `onSettled`
 * invalidates the feed list so sidebar counts catch up once the dust settles, whether the mutation
 * succeeded or not.
 */
export const useReadState = (): ReadState => {
  const queryClient = useQueryClient();

  const mutation = useMutation<undefined, Error, { itemIds: number[]; read: boolean }, ReadStateContext>({
    mutationFn: async (variables) => {
      const result = await window.electron.ipcRenderer.invoke('items:set-read', variables);
      if (!result.success) {
        throw new Error(result.error.message);
      }
    },
    onMutate: async ({ itemIds, read }) => {
      await queryClient.cancelQueries({ queryKey: ['river'] });

      const targetIds = new Set(itemIds);
      const readAt = read ? new Date().toISOString() : undefined;
      const previousReadAt = new Map<number, string | undefined>();
      queryClient.setQueriesData<InfiniteData<RiverPage>>(
        { queryKey: ['river'] },
        (data) => (data ? patchRiverRows(data, targetIds, (row) => {
          previousReadAt.set(row.id, row.readAt);
          return { ...row, readAt };
        }) : data),
      );

      return { previousReadAt };
    },
    onError: (error, _variables, context) => {
      console.error('Error persisting read state:', error);
      if (!context) {
        return;
      }
      queryClient.setQueriesData<InfiniteData<RiverPage>>(
        { queryKey: ['river'] },
        (data) => (data ? patchRiverRows(data, new Set(context.previousReadAt.keys()), (row) => ({ ...row, readAt: context.previousReadAt.get(row.id) })) : data),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
    },
  });

  const { mutate } = mutation;
  const markRead = useCallback((id: number) => mutate({ itemIds: [id], read: true }), [mutate]);
  const markAllRead = useCallback((ids: number[]) => {
    if (ids.length > 0) {
      mutate({ itemIds: ids, read: true });
    }
  }, [mutate]);
  const toggleRead = useCallback((id: number, currentlyRead: boolean) => mutate({ itemIds: [id], read: !currentlyRead }), [mutate]);

  return { markRead, markAllRead, toggleRead };
};
