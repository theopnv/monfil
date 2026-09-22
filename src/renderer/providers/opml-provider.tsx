import { useCallback } from "react";
import { ipc } from '@/lib/ipc-client';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExportOpmlError } from "../../shared/contracts";
import type { ImportOpmlError, ImportOpmlTarget, ImportSummary } from "../../shared/contracts";
import type { Result } from "../../shared/result";
import { queryKeys } from "../lib/queries";

export const useImportOpml = (): ((target: ImportOpmlTarget) => Promise<Result<ImportSummary, ImportOpmlError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (target: ImportOpmlTarget) => ipc.invoke('opml:import', { target }),
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
  return useCallback((target: ImportOpmlTarget) => mutateAsync(target), [mutateAsync]);
};

export const useExportOpml = (): ((workspaceId: number) => Promise<Result<void, ExportOpmlError>>) => {
  const mutation = useMutation({
    mutationFn: (workspaceId: number) => ipc.invoke('opml:export', { workspaceId }),
  });
  const { mutateAsync } = mutation;
  return useCallback((workspaceId: number) => mutateAsync(workspaceId), [mutateAsync]);
};
