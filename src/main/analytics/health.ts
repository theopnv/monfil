// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { observeLogs } from '../logging/logger';
import type { LogEventMap, LogEventName } from '../../shared/logging';
import type { UsageCounter } from '../../shared/contracts';
import { incrementCounter } from './counters';
import { refreshErrorCounter } from './error-buckets';

function refreshCounters(error: unknown): UsageCounter[] {
  const bucket = refreshErrorCounter(error);
  return bucket ? ['refresh_failures', bucket] : ['refresh_failures'];
}

function healthCounters(event: LogEventName, data: LogEventMap[LogEventName], error: unknown): UsageCounter[] {
  switch (event) {
    case 'feed.refresh': return refreshCounters(error);
    case 'operation.failure': return (data as LogEventMap['operation.failure']).operation === 'extract-article' ? ['extraction_failures'] : [];
    case 'ipc.failure': return ['ipc_failures'];
    case 'renderer.failure': return ['renderer_failures'];
    default: return [];
  }
}

export function startHealthCounters(): () => void {
  return observeLogs((event, data, _level, error) => {
    for (const counter of healthCounters(event, data, error)) {
      void incrementCounter(counter);
    }
  });
}
