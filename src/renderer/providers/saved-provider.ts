// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useMutation, useQueryClient, type InfiniteData, type QueryKey } from '@tanstack/react-query';
import { ipc } from '@/lib/ipc-client';
import { notifyError } from '@/lib/notifications';
import { patchRiverRows, type RiverScope } from '@/lib/queries';
import { useActiveWorkspaceId } from './workspace-provider';
import type { RiverPage, SetSavedItemInput } from '../../shared/contracts';

export function useSavedState() {
  const workspaceId = useActiveWorkspaceId();
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: async (input: SetSavedItemInput) => {
      const result = await ipc.invoke('items:set-saved', input);
      if (!result.success) {
        throw new Error(result.error.message);
      }
    },
    onMutate: async (input) => {
      const filter = {
        queryKey: ['river'],
        predicate: (query: { queryKey: QueryKey }) => (query.queryKey[1] as RiverScope).workspaceId === input.workspaceId,
      };
      await queryClient.cancelQueries(filter);
      const previous: { key: QueryKey; savedAt: number | undefined }[] = [];
      for (const [key, data] of queryClient.getQueriesData<InfiniteData<RiverPage>>(filter)) {
        if (!data) {
          continue;
        }
        const row = data.pages.flatMap((page) => page.rows).find((item) => item.id === input.itemId);
        if (!row) {
          continue;
        }
        previous.push({ key, savedAt: row.savedAt });
        queryClient.setQueryData(key, patchRiverRows(data, new Set([input.itemId]), (item) => ({
          ...item, savedAt: input.saved ? item.savedAt ?? Date.now() : undefined,
        })));
      }
      return previous;
    },
    onError: (_error, input, previous) => {
      for (const { key, savedAt } of previous ?? []) {
        queryClient.setQueryData<InfiniteData<RiverPage>>(key, (data) => data
          ? patchRiverRows(data, new Set([input.itemId]), (item) => ({ ...item, savedAt }))
          : data);
      }
      notifyError(input.saved ? 'The item could not be saved. Try again.' : 'The item could not be removed from Saved. Try again.');
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: ['river'] });
    },
  });
  return {
    setSaved: (itemId: number, saved: boolean, onSuccess?: () => void) => mutation.mutate(
      { workspaceId, itemId, saved },
      onSuccess ? { onSuccess } : {},
    ),
    isPending: mutation.isPending,
  };
}
