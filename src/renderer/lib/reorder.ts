// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

/**
 * The ids in their new order once the `moved` ones are dropped before or after `target`.
 * Moved ids keep their relative order.
 */
export function reorderIds(ids: readonly number[], moved: ReadonlySet<unknown>, target: unknown, position: 'before' | 'after'): number[] {
  const staying = ids.filter((id) => !moved.has(id));
  const targetIndex = staying.findIndex((id) => id === target);
  if (targetIndex === -1) {
    return [...ids];
  }
  staying.splice(position === 'before' ? targetIndex : targetIndex + 1, 0, ...ids.filter((id) => moved.has(id)));
  return staying;
}
