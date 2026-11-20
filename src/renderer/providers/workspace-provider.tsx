// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { type PropsWithChildren } from "react";
import { ipc } from '@/lib/ipc-client';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { ResultOf } from "../../shared/ipc-schema";
import { ActiveWorkspaceIdContext, useActiveWorkspaceId } from "@/lib/active-workspace";
import { invalidationSets, queryKeys, workspaceRailExpandedQuery, workspacesQuery } from "../lib/queries";
import { useResultMutation } from "@/lib/use-result-mutation";
import { HOME_WORKSPACE_ID, type WorkspaceSummary } from "../../shared/contracts";
import { parseRouteId } from '@/lib/route-params';

export { useActiveWorkspaceId };

/**
 * Mounted once at the root, above the router outlet: reads `workspaceId` off the URL
 * (`/workspace/$workspaceId`) and republishes it as plain context, so every consumer of
 * `useActiveWorkspaceId` stays decoupled from the router itself and Home is the default off a
 * route that carries no `workspaceId` param at all (e.g. `/settings`).
 */
export const ActiveWorkspaceIdProvider = ({ children }: PropsWithChildren) => {
  const params = useParams({ strict: false });
  const activeWorkspaceId = parseRouteId(params.workspaceId) ?? HOME_WORKSPACE_ID;

  return (
    <ActiveWorkspaceIdContext.Provider value={activeWorkspaceId}>
      {children}
    </ActiveWorkspaceIdContext.Provider>
  );
};

export const useWorkspaces = (): WorkspaceSummary[] => {
  const { data } = useQuery(workspacesQuery());
  return data ?? [];
};

/** Whether the rail shows workspace names. It reads as collapsed until the stored value arrives. */
export const useWorkspaceRailExpanded = (): [boolean, (expanded: boolean) => void] => {
  const queryClient = useQueryClient();
  const { data } = useQuery(workspaceRailExpandedQuery());
  const { mutate } = useMutation({
    mutationFn: (expanded: boolean) => ipc.invoke('settings:set', { key: 'workspaceRailExpanded', value: expanded }),
    onMutate: (expanded) => queryClient.setQueryData(queryKeys.workspaceRailExpanded, expanded),
    onSettled: () => void queryClient.invalidateQueries({ queryKey: queryKeys.workspaceRailExpanded }),
  });
  return [data ?? false, mutate];
};

export const useActiveWorkspace =(): WorkspaceSummary | undefined => {
  const workspaces = useWorkspaces();
  const activeWorkspaceId = useActiveWorkspaceId();
  return workspaces.find((workspace) => workspace.id === activeWorkspaceId);
};

export const useCreateWorkspace = () => useResultMutation('workspaces:create', { invalidate: invalidationSets.workspaces });

export const useUpdateWorkspace = () => useResultMutation('workspaces:update', { invalidate: invalidationSets.workspaces });

export const useDeleteWorkspace = () => useResultMutation('workspaces:delete', { invalidate: invalidationSets.workspaceContents });

export const useReorderWorkspaces = (): ((orderedIds: number[]) => Promise<ResultOf<'workspaces:reorder'>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (orderedIds: number[]) => ipc.invoke('workspaces:reorder', { orderedIds }),
    onMutate: (orderedIds) => {
      // Stryker disable next-line ConditionalExpression: the rail can only be dragged once the list has loaded
      queryClient.setQueryData<WorkspaceSummary[]>(queryKeys.workspaces, (current) => current && orderedIds.flatMap((id) => current.filter((workspace) => workspace.id === id)));
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.workspaces }),
  });
  return mutation.mutateAsync;
};

export const useMoveFeedToWorkspace = () => useResultMutation('feeds:move-to-workspace', { invalidate: invalidationSets.workspaceContents });
