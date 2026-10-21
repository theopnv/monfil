// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { DotsGrid, Eye, EyeOff, LayerSingle } from "@untitledui/icons";
import { Button as DragHandleButton } from "react-aria-components";
import { ipc } from '@/lib/ipc-client';
import FeedAvatar from "@/components/Home/FeedAvatar";
import { cx } from "@/components/untitled-ui/utils/cx";
import {
  feedVisibility,
  focusActionLabel,
  folderVisibility,
  hideActionLabel,
  toggleFocus,
  toggleFolderFocus,
  toggleFolderHidden,
  toggleHidden,
  VISIBILITY_STATE_LABEL,
  type FeedVisibility,
} from "@/lib/river/feed-visibility";
import { resolveFeedIcon } from "@/lib/favicon";
import type { FeedSummary } from "../../../shared/contracts";

type SetVisibility = (feeds: FeedSummary[], target: FeedVisibility) => void;

// Folder and feed counts share a right edge, so a column of them reads as one vertical line.
export const COUNT_CLASSES = 'w-6 flex-none text-right text-xs text-tertiary tabular-nums';
// A feed row ends with the eye button; a folder row reserves the same width after its count.
export const EYE_SLOT_WIDTH_CLASSES = 'size-5.5';
export const EYE_SLOT_MARGIN_CLASSES = 'mr-5.5';

const REVEALED = 'opacity-0 focus-visible:opacity-100';

export function FeedRow({ feed, showOnlyLinks, isDropTarget, onSetVisibility }: {
  feed: FeedSummary;
  showOnlyLinks: ReadonlySet<string>;
  isDropTarget: boolean;
  onSetVisibility: SetVisibility;
}) {
  const state = feedVisibility(feed, showOnlyLinks);
  const focusAction = focusActionLabel(state);
  const hideAction = hideActionLabel(state);
  const HideIcon = state === "hidden" ? Eye : EyeOff;

  return (
    <div className={cx("group/row flex min-w-0 items-center rounded-xl pl-2", isDropTarget && "bg-primary_hover")}>
      <DragHandleButton
        slot="drag"
        aria-label="Drag to a folder"
        className="flex-none cursor-grab px-0.5 text-quaternary opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
      >
        <DotsGrid aria-hidden className="size-3.5" />
      </DragHandleButton>
      <button
        type="button"
        title={`${feed.title} — ${VISIBILITY_STATE_LABEL[state]}. Click to ${focusAction.toLowerCase()}.`}
        aria-label={`${feed.title}, ${VISIBILITY_STATE_LABEL[state]}${feed.unreadCount > 0 ? `, ${feed.unreadCount} unread` : ''}. Click to ${focusAction.toLowerCase()}.`}
        data-visibility={state}
        onClick={() => onSetVisibility([feed], toggleFocus(state))}
        onContextMenu={(event) => {
          event.preventDefault();
          ipc.send('feeds:show-feed-context-menu', feed.id);
        }}
        className={cx(
          "flex min-w-0 flex-1 items-center gap-2.25 rounded-xl px-2.25 py-1.5 text-left text-sm hover:bg-primary_hover",
          state === "only" && "bg-primary_hover font-semibold text-primary",
          state === "hidden" && "text-quaternary opacity-60",
          state === "home" && "text-secondary",
        )}
      >
        <FeedAvatar title={feed.title} faviconUrl={resolveFeedIcon(feed.icon, feed.link)} size="sm" />
        <span className="min-w-0 flex-1 truncate">{feed.title}</span>
        {feed.last_error && <span role="img" aria-label={`${feed.title} refresh failed`} title="The last refresh failed" className="text-warning-primary">!</span>}
        <span data-testid="feed-count" className={COUNT_CLASSES}>{feed.unreadCount > 0 ? feed.unreadCount : ''}</span>
      </button>
      <button
        type="button"
        title={`${hideAction} ${feed.title}`}
        aria-label={`${hideAction} ${feed.title}`}
        onClick={() => onSetVisibility([feed], toggleHidden(state))}
        className={cx(
          "flex flex-none items-center justify-center rounded-md text-quaternary hover:text-secondary",
          EYE_SLOT_WIDTH_CLASSES,
          state === "hidden" ? "opacity-100" : cx(REVEALED, "group-hover/row:opacity-100"),
        )}
      >
        <HideIcon aria-hidden className="size-3.5" />
      </button>
    </div>
  );
}

export function FolderVisibilityControls({ folderName, feeds, showOnlyLinks, onSetVisibility }: {
  folderName: string;
  feeds: FeedSummary[];
  showOnlyLinks: ReadonlySet<string>;
  onSetVisibility: SetVisibility;
}) {
  const state = folderVisibility(feeds, showOnlyLinks);
  const focusAction = focusActionLabel(state);
  const hideAction = hideActionLabel(state);
  const HideIcon = state === "hidden" ? Eye : EyeOff;

  return (
    <>
      <button
        type="button"
        aria-label={`${focusAction} ${folderName}`}
        onClick={() => onSetVisibility(feeds, toggleFolderFocus(feeds, showOnlyLinks))}
        className={cx("flex-none", state === "only" ? "opacity-100" : cx(REVEALED, "group-hover:opacity-100"))}
      >
        <LayerSingle aria-hidden className="size-3.5 text-quaternary" />
      </button>
      <button
        type="button"
        aria-label={`${hideAction} ${folderName}`}
        onClick={() => onSetVisibility(feeds, toggleFolderHidden(feeds, showOnlyLinks))}
        className={cx("flex-none", state === "hidden" ? "opacity-100" : cx(REVEALED, "group-hover:opacity-100"))}
      >
        <HideIcon aria-hidden className="size-3.5 text-quaternary" />
      </button>
    </>
  );
}
