// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { observeLogs } from '../logging/logger';
import type { LogEventMap, LogEventName } from '../../shared/logging';
import type { UsageCounter } from '../../shared/contracts';
import { incrementCounter } from './counters';

function healthCounter(event: LogEventName, data: LogEventMap[LogEventName]): UsageCounter | undefined {
  switch (event) {
    case 'feed.refresh': return 'refresh_failures';
    case 'operation.failure': return (data as LogEventMap['operation.failure']).operation === 'extract-article' ? 'extraction_failures' : undefined;
    case 'ipc.failure': return 'ipc_failures';
    case 'renderer.failure': return 'renderer_failures';
    default: return undefined;
  }
}

/** Counts the failures that the logger sees. Returns a function that stops counting. */
export function startHealthCounters(): () => void {
  return observeLogs((event, data) => {
    const counter = healthCounter(event, data);
    if (counter) {
      void incrementCounter(counter);
    }
  });
}
