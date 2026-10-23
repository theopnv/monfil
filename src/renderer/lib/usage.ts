// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ipc, rendererLogger } from '@/lib/ipc-client';
import { queryKeys, usageAnalyticsQuery } from '@/lib/queries';
import type { RendererUsageCounter, UsageAnalyticsState } from '../../shared/contracts';

/** Tells the main process that the user did something it cannot see. The main process counts it only with consent. */
export function recordUsage(counter: RendererUsageCounter): void {
  ipc.send('usage:record', { counter });
}

/** The consent state and the calls that change it. */
export function useUsageAnalytics() {
  const queryClient = useQueryClient();
  const { data } = useQuery(usageAnalyticsQuery());
  const store = (state: UsageAnalyticsState) => queryClient.setQueryData(queryKeys.usageAnalytics, state);
  const onError = (error: unknown) => rendererLogger.error('renderer.failure', { message: 'Could not save usage stats choice' }, error);

  const choose = useMutation({
    mutationFn: (choice: 'granted' | 'denied') => ipc.invoke('settings:set-usage-analytics', choice),
    onSuccess: store,
    onError,
  });
  const dismiss = useMutation({
    mutationFn: () => ipc.invoke('settings:dismiss-usage-analytics-prompt', undefined),
    onSuccess: store,
    onError,
  });

  return { state: data, choose: choose.mutate, dismiss: dismiss.mutate };
}
