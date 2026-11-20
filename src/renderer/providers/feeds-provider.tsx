// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useCallback } from "react";
import { ipc, rendererLogger } from '@/lib/ipc-client';
import { notifyWarning } from '@/lib/notifications';
import { translateFeedFailure } from '@/lib/error-text';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type UseInfiniteQueryResult } from "@tanstack/react-query";
import type { FeedCategory, FeedSummary, RiverPage } from "../../shared/contracts";
import { categoriesQuery, feedsQuery, invalidationSets, patchRiverRows, queryKeys, riverQuery, type RiverScope } from "../lib/queries";
import { useActiveWorkspaceId } from "@/lib/active-workspace";
import { useResultMutation } from "@/lib/use-result-mutation";
import { applyRefreshNow } from '../lib/push-events';

export const useFeeds = (): FeedSummary[] => {
  const workspaceId = useActiveWorkspaceId();
  const { data } = useQuery(feedsQuery(workspaceId));
  return data ?? [];
};

/** True until the active workspace's feed list has loaded once, so callers can tell "not loaded yet" from "no feeds". */
export const useFeedsPending = (): boolean => {
  const workspaceId = useActiveWorkspaceId();
  const { isPending } = useQuery(feedsQuery(workspaceId));
  return isPending;
};

export const useCategories = (): FeedCategory[] => {
  const workspaceId = useActiveWorkspaceId();
  const { data } = useQuery(categoriesQuery(workspaceId));
  return data ?? [];
};

export const useRiver = (scope: RiverScope, enabled = true): UseInfiniteQueryResult<InfiniteData<RiverPage>> => useInfiniteQuery({ ...riverQuery(scope), enabled });

export const useAddFeed = () => useResultMutation('feeds:submit-add-feed', { invalidate: invalidationSets.feedsAndCategories, withWorkspace: true });

export const useDeleteFeed = () => useResultMutation('feeds:delete-feed', { invalidate: invalidationSets.feeds, withWorkspace: true });

export const useSetShowInWorkspace = () => useResultMutation('feeds:set-show-in-workspace', { invalidate: invalidationSets.feeds, withWorkspace: true });

export const useCreateCategory = () => useResultMutation('feeds:create-category', { invalidate: invalidationSets.categories, withWorkspace: true });

export const useRenameCategory = () => useResultMutation('feeds:rename-category', { invalidate: invalidationSets.feedsAndCategories, withWorkspace: true });

export const useDeleteCategory = () => useResultMutation('feeds:delete-category', { invalidate: invalidationSets.feedsAndCategories, withWorkspace: true });

export const useMoveFeeds = () => useResultMutation('feeds:move-feeds-to-category', { invalidate: invalidationSets.feeds, withWorkspace: true });

const MAX_FAILURE_LINES = 3;

interface FeedsRefresh {
  refreshNow: () => void;
  isRefreshing: boolean;
  refreshFailed: boolean;
}

export const useFeedsRefresh = (): FeedsRefresh => {
  const { t } = useTranslation(['river', 'common']);
  const { t: tErrors } = useTranslation('errors');
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => ipc.invoke('feeds:refresh'),
    onSuccess: (summary) => {
      // A user-initiated refresh gets its content immediately; an automatic cycle's `feeds:refreshed`
      // push only raises the pill (see `usePushEvents`), so it never moves the river under the user.
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedsAll });
      applyRefreshNow(queryClient);
      if (summary.failedFeeds?.length) {
        const count = summary.failedFeeds.length;
        const lines = summary.failedFeeds.slice(0, MAX_FAILURE_LINES).map((failure) => `${failure.title}: ${translateFeedFailure(tErrors, failure)}`);
        if (count > MAX_FAILURE_LINES) {
          lines.push(t('river:refresh.more', { count: count - MAX_FAILURE_LINES }));
        }
        notifyWarning(t('river:refresh.failed', { count }), 'manual-refresh-failures', {
          label: t('common:action.showLog'),
          onClick: () => ipc.send('app:reveal', 'log'),
        }, lines);
      }
    },
    onError: (error: unknown) => {
      rendererLogger.error('renderer.failure', { message: 'Error refreshing feeds:' }, error);
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
      const result = await ipc.invoke('items:set-read', variables);
      if (!result.success) {
        throw new Error(result.error.message);
      }
    },
    onMutate: async ({ itemIds, read }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.riverAll });

      const targetIds = new Set(itemIds);
      const readAt = read ? new Date().toISOString() : undefined;
      const previousReadAt = new Map<number, string | undefined>();
      queryClient.setQueriesData<InfiniteData<RiverPage>>(
        { queryKey: queryKeys.riverAll },
        (data) => (data ? patchRiverRows(data, targetIds, (row) => {
          previousReadAt.set(row.id, row.readAt);
          return { ...row, readAt };
        }) : data),
      );

      return { previousReadAt };
    },
    onError: (error, _variables, context) => {
      rendererLogger.error('renderer.failure', { message: 'Error persisting read state:' }, error);
      if (!context) {
        return;
      }
      queryClient.setQueriesData<InfiniteData<RiverPage>>(
        { queryKey: queryKeys.riverAll },
        (data) => (data ? patchRiverRows(data, new Set(context.previousReadAt.keys()), (row) => ({ ...row, readAt: context.previousReadAt.get(row.id) })) : data),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: queryKeys.feedsAll });
    },
  });

  const { mutate } = mutation;
  // Stryker disable next-line ArrayDeclaration: mutate is the same function on every render
  const markRead = useCallback((id: number) => mutate({ itemIds: [id], read: true }), [mutate]);
  const markAllRead = useCallback((ids: number[]) => {
    if (ids.length > 0) {
      mutate({ itemIds: ids, read: true });
    }
  }, [mutate]);
  // Stryker disable next-line ArrayDeclaration: mutate is the same function on every render
  const toggleRead = useCallback((id: number, currentlyRead: boolean) => mutate({ itemIds: [id], read: !currentlyRead }), [mutate]);

  return { markRead, markAllRead, toggleRead };
};
