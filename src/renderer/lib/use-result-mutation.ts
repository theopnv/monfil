// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ipc } from '@/lib/ipc-client';
import { useActiveWorkspaceId } from '@/lib/active-workspace';
import { invalidateAll } from '@/lib/queries';
import type { ArgOf, InvokeChannel, ResultOf } from '../../shared/ipc-schema';
import type { Result } from '../../shared/result';

/** The invoke channels that answer with a `Result`. */
type ResultChannel = { [C in InvokeChannel]: ResultOf<C> extends Result<unknown, unknown> ? C : never }[InvokeChannel];

type Variables<C extends ResultChannel, W extends boolean> = W extends true ? Omit<ArgOf<C>, 'workspaceId'> : ArgOf<C>;

interface Options<W extends boolean> {
  /** The queries a successful call makes stale. A failed `Result` invalidates nothing. */
  invalidate: readonly (readonly unknown[])[];
  /** Adds the active workspace to the request, so the caller does not repeat it. */
  withWorkspace?: W;
}

/** A call to a `Result` channel that refreshes what it changed. The returned function is stable until the active workspace changes. */
export function useResultMutation<C extends ResultChannel, W extends boolean = false>(channel: C, { invalidate, withWorkspace }: Options<W>): (variables: Variables<C, W>) => Promise<ResultOf<C>> {
  const workspaceId = useActiveWorkspaceId();
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationFn: (variables: ArgOf<C>) => (ipc.invoke as (channel: string, arg: unknown) => Promise<ResultOf<C>>)(channel, variables),
    onSuccess: (result) => {
      if ((result as Result<unknown, unknown>).success) {
        invalidateAll(queryClient, invalidate);
      }
    },
  });
  return useCallback(
    (variables: Variables<C, W>) => mutateAsync((withWorkspace ? { ...(variables as object), workspaceId } : variables) as ArgOf<C>),
    [mutateAsync, workspaceId, withWorkspace],
  );
}
