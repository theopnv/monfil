// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { TwoWayRendererMainChannels, TwoWayRendererMainChannelsInvokeArgs } from '../../shared/channels';
import type { UsageCounter } from '../../shared/contracts';
import { incrementCounter } from './counters';

type CounterRule<C extends TwoWayRendererMainChannels> = UsageCounter | ((arg: TwoWayRendererMainChannelsInvokeArgs[C]) => UsageCounter | undefined);

const COUNTER_RULES: { [C in TwoWayRendererMainChannels]?: CounterRule<C> } = {
  'items:get-content': 'articles_opened',
  'feeds:submit-add-feed': 'feeds_added',
  'feeds:delete-feed': 'feeds_removed',
  'feeds:refresh': 'manual_refreshes',
  'items:set-saved': (arg) => (arg.saved ? 'items_saved' : undefined),
  'feedpacks:install': 'feedpacks_installed',
  'opml:import': 'opml_imported',
  'opml:export': 'opml_exported',
  'app:back-up-database': 'backups_made',
  'workspaces:create': 'workspaces_created',
};

function isFailure(response: unknown): boolean {
  return typeof response === 'object' && response !== null && 'success' in response && response.success === false;
}

/**
 * Counts a finished request when its channel has a counter. A response that carries a failed `Result` counts for nothing.
 * @param channel the channel that was invoked
 * @param arg the payload of the request
 * @param response what the handler returned
 */
export function recordInvokeUsage<C extends TwoWayRendererMainChannels>(channel: C, arg: TwoWayRendererMainChannelsInvokeArgs[C], response: unknown): void {
  const rule = COUNTER_RULES[channel] as CounterRule<C> | undefined;
  if (rule === undefined || isFailure(response)) {
    return;
  }
  const counter = typeof rule === 'function' ? rule(arg) : rule;
  if (counter) {
    void incrementCounter(counter);
  }
}
