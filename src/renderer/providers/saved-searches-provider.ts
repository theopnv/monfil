// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ipc } from "@/lib/ipc-client";
import { savedSearchesQuery } from "@/lib/queries";
import { useActiveWorkspaceId } from "./workspace-provider";
import type { SavedSearch, SavedSearchError, SavedSearchSummary } from "../../shared/contracts";
import type { Result } from "../../shared/result";

export interface SavedSearches {
  searches: SavedSearchSummary[];
  hintExample: string | undefined;
}

const NONE: SavedSearches = { searches: [], hintExample: undefined };

/** The saved searches of the active workspace, in pill order. */
export const useSavedSearches = (): SavedSearches => {
  const workspaceId = useActiveWorkspaceId();
  const { data } = useQuery(savedSearchesQuery(workspaceId));
  return data ?? NONE;
};

export interface SavedSearchActions {
  create: (name: string, query: string) => Promise<Result<SavedSearch, SavedSearchError>>;
  update: (searchId: number, patch: { name?: string; query?: string }) => Promise<Result<SavedSearch, SavedSearchError>>;
  remove: (searchId: number) => Promise<Result<void, SavedSearchError>>;
  dismissHint: () => Promise<void>;
}

export const useSavedSearchActions = (): SavedSearchActions => {
  const workspaceId = useActiveWorkspaceId();
  const queryClient = useQueryClient();
  const refresh = useCallback(() => queryClient.invalidateQueries({ queryKey: ["feeds", "searches"] }), [queryClient]);

  const create = useCallback(async (name: string, query: string) => {
    const result = await ipc.invoke("searches:create", { workspaceId, name, query });
    await refresh();
    return result;
  }, [workspaceId, refresh]);

  const update = useCallback(async (searchId: number, patch: { name?: string; query?: string }) => {
    const result = await ipc.invoke("searches:update", { searchId, ...patch });
    await refresh();
    return result;
  }, [refresh]);

  const remove = useCallback(async (searchId: number) => {
    const result = await ipc.invoke("searches:delete", { searchId });
    await refresh();
    return result;
  }, [refresh]);

  const dismissHint = useCallback(async () => {
    await ipc.invoke("searches:dismiss-hint", { workspaceId });
    await refresh();
  }, [workspaceId, refresh]);

  return { create, update, remove, dismissHint };
};
