// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

export function callName(channel: string, arg: unknown): string {
  return channel === 'settings:get' || channel === 'settings:set' ? `${channel}:${(arg as { key: string }).key}` : channel;
}
