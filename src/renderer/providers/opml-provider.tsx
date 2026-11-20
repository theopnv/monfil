// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback } from "react";
import { ipc } from '@/lib/ipc-client';
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { ExportOpmlError } from "../../shared/contracts";
import type { ImportOpmlError, ImportOpmlTarget, ImportSummary } from "../../shared/contracts";
import type { Result } from "../../shared/result";
import { invalidateAll, invalidationSets } from "../lib/queries";

export const useImportOpml = (): ((target: ImportOpmlTarget) => Promise<Result<ImportSummary, ImportOpmlError>>) => {
  const queryClient = useQueryClient();
  const mutation = useMutation({
    mutationFn: (target: ImportOpmlTarget) => ipc.invoke('opml:import', { target }),
    onSuccess: (result) => {
      if (result.success) {
        invalidateAll(queryClient, invalidationSets.workspaceContents);
      }
    },
  });
  const { mutateAsync } = mutation;
  // Stryker disable next-line ArrayDeclaration: mutateAsync is the same function on every render
  return useCallback((target: ImportOpmlTarget) => mutateAsync(target), [mutateAsync]);
};

export const useExportOpml = (): ((workspaceId: number) => Promise<Result<void, ExportOpmlError>>) => {
  const mutation = useMutation({
    mutationFn: (workspaceId: number) => ipc.invoke('opml:export', { workspaceId }),
  });
  const { mutateAsync } = mutation;
  // Stryker disable next-line ArrayDeclaration: mutateAsync is the same function on every render
  return useCallback((workspaceId: number) => mutateAsync(workspaceId), [mutateAsync]);
};
