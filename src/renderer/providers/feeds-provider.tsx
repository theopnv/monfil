import { useCallback } from "react";
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import type { FeedSummary, RiverPage } from "../../preload/channels";
import type { DeleteFeedError } from "../../main/db/crud/delete";
import type { AddFeedError, NewFeedInput } from "../../main/db/crud/insert";
import type { UpdateFeedError } from "../../main/db/crud/update";
import type { Result } from "../../main/lib/utils";
import { feedsQuery, patchRiverRows, queryKeys, riverQuery, type RiverScope } from "../lib/queries";

export const useFeeds = (): FeedSummary[] => {
  const { data } = useQuery(feedsQuery());
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

export const useSetShowInHome = (): ((feedIds: number[], showInHome: boolean) => Promise<Result<void, UpdateFeedError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: { feedIds: number[]; showInHome: boolean }) => window.electron.ipcRenderer.invoke('feeds:set-show-in-home', variables),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.feeds });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((feedIds: number[], showInHome: boolean) => mutateAsync({ feedIds, showInHome }), [mutateAsync]);
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
