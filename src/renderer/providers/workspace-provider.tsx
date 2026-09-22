import { createContext, useCallback, useContext, type PropsWithChildren } from "react";
import { ipc } from '@/lib/ipc-client';
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams } from "@tanstack/react-router";
import type { DeleteWorkspaceError } from "../../shared/contracts";
import type { CreateWorkspaceError } from "../../shared/contracts";
import type { MoveFeedError, UpdateWorkspaceError } from "../../shared/contracts";
import type { Result } from "../../shared/result";
import { queryKeys, workspacesQuery } from "../lib/queries";
import { HOME_WORKSPACE_ID, type Workspace, type WorkspaceSummary } from "../../shared/contracts";

const ActiveWorkspaceIdContext = createContext<number>(HOME_WORKSPACE_ID);

/** The workspace the URL currently points at, or Home for a component tree with no provider (most unit tests). */
export const useActiveWorkspaceId = (): number => useContext(ActiveWorkspaceIdContext);

/**
 * Mounted once at the root, above the router outlet: reads `workspaceId` off the URL
 * (`/workspace/$workspaceId`) and republishes it as plain context, so every consumer of
 * `useActiveWorkspaceId` stays decoupled from the router itself and Home is the default off a
 * route that carries no `workspaceId` param at all (e.g. `/settings`).
 */
export const ActiveWorkspaceIdProvider = ({ children }: PropsWithChildren) => {
  const params = useParams({ strict: false });
  const activeWorkspaceId = params.workspaceId ? Number(params.workspaceId) : HOME_WORKSPACE_ID;

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

export const useActiveWorkspace = (): WorkspaceSummary | undefined => {
  const workspaces = useWorkspaces();
  const activeWorkspaceId = useActiveWorkspaceId();
  return workspaces.find((workspace) => workspace.id === activeWorkspaceId);
};

export const useCreateWorkspace = (): ((input: { name: string; icon: string; color: string }) => Promise<Result<Workspace, CreateWorkspaceError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (input: { name: string; icon: string; color: string }) => ipc.invoke('workspaces:create', input),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((input: { name: string; icon: string; color: string }) => mutateAsync(input), [mutateAsync]);
};

export const useUpdateWorkspace = (): ((workspaceId: number, patch: { name?: string; icon?: string; color?: string }) => Promise<Result<Workspace, UpdateWorkspaceError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: { workspaceId: number; name?: string; icon?: string; color?: string }) => ipc.invoke('workspaces:update', variables),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((workspaceId: number, patch: { name?: string; icon?: string; color?: string }) => mutateAsync({ workspaceId, ...patch }), [mutateAsync]);
};

export const useDeleteWorkspace = (): ((workspaceId: number) => Promise<Result<void, DeleteWorkspaceError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (workspaceId: number) => ipc.invoke('workspaces:delete', { workspaceId }),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
        void queryClient.invalidateQueries({ queryKey: ['feeds'] });
        void queryClient.invalidateQueries({ queryKey: ['categories'] });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((workspaceId: number) => mutateAsync(workspaceId), [mutateAsync]);
};

export const useReorderWorkspaces = (): ((orderedIds: number[]) => Promise<Result<void, UpdateWorkspaceError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (orderedIds: number[]) => ipc.invoke('workspaces:reorder', { orderedIds }),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback((orderedIds: number[]) => mutateAsync(orderedIds), [mutateAsync]);
};

export const useMoveFeedToWorkspace = (): ((feedId: number, fromWorkspaceId: number, toWorkspaceId: number, categoryName: string) => Promise<Result<void, MoveFeedError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (variables: { feedId: number; fromWorkspaceId: number; toWorkspaceId: number; categoryName: string }) => ipc.invoke('feeds:move-to-workspace', variables),
    onSuccess: (result) => {
      if (result.success) {
        void queryClient.invalidateQueries({ queryKey: ['feeds'] });
        void queryClient.invalidateQueries({ queryKey: ['categories'] });
        void queryClient.invalidateQueries({ queryKey: ['river'] });
        void queryClient.invalidateQueries({ queryKey: queryKeys.workspaces });
      }
    },
  });
  const { mutateAsync } = mutation;
  return useCallback(
    (feedId: number, fromWorkspaceId: number, toWorkspaceId: number, categoryName: string) => mutateAsync({ feedId, fromWorkspaceId, toWorkspaceId, categoryName }),
    [mutateAsync],
  );
};
