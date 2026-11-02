// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

// A custom MIME-like type keeps the drag payload from being accepted by anything but Monfil's own drop targets.
export const FEED_DRAG_TYPE = 'application/x-monfil-feed';

/** What a dragged feed row carries, so a drop in another workspace knows where the feed comes from. */
export interface FeedDragPayload {
  feedId: number;
  workspaceId: number;
  categoryName: string;
}

export function encodeFeedDrag(payload: FeedDragPayload): string {
  return JSON.stringify(payload);
}

export function decodeFeedDrag(text: string): FeedDragPayload | null {
  try {
    const value: unknown = JSON.parse(text);
    if (typeof value === 'object' && value !== null && 'feedId' in value && 'workspaceId' in value && 'categoryName' in value
      && typeof value.feedId === 'number' && typeof value.workspaceId === 'number' && typeof value.categoryName === 'string') {
      return { feedId: value.feedId, workspaceId: value.workspaceId, categoryName: value.categoryName };
    }
  } catch {
    return null;
  }
  return null;
}
