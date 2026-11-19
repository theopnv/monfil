// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { DotsGrid, Eye, EyeOff, LayerSingle } from "@untitledui/icons";
import { Button as DragHandleButton } from "react-aria-components";
import { ipc } from '@/lib/ipc-client';
import FeedAvatar from "@/components/common/FeedAvatar";
import { cx } from "@/components/untitled-ui/utils/cx";
import {
  feedVisibility,
  focusAction,
  folderVisibility,
  hideAction,
  toggleFocus,
  toggleFolderFocus,
  toggleFolderHidden,
  toggleHidden,
  type FeedVisibility,
} from "@/lib/river/feed-visibility";
import type { FeedSummary } from "../../../shared/contracts";

type SetVisibility = (feeds: FeedSummary[], target: FeedVisibility) => void;

const EYE_SLOT_CLASSES = 'h-5.5 w-5.5';

// Hidden controls take no width, so a name uses the full row until the pointer or focus reveals them.
const COLLAPSED = 'w-0 overflow-hidden opacity-0 focus-visible:w-auto focus-visible:opacity-100';

export function FeedRow({ feed, showOnlyLinks, isDropTarget, onSetVisibility }: {
  feed: FeedSummary;
  showOnlyLinks: ReadonlySet<string>;
  isDropTarget: boolean;
  onSetVisibility: SetVisibility;
}) {
  const { t } = useTranslation('river');
  const state = feedVisibility(feed, showOnlyLinks);
  const focus = focusAction(state);
  const hide = hideAction(state);
  const stateLabel = t(`feed.state.${state}`);
  const HideIcon = state === "hidden" ? Eye : EyeOff;

  return (
    <div className={cx("group/row flex min-w-0 items-center rounded-xl ps-2", isDropTarget && "bg-primary_hover")}>
      <DragHandleButton
        slot="drag"
        aria-label={t('feed.dragToFolder')}
        className="flex-none cursor-grab px-0.5 text-quaternary opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100"
      >
        <DotsGrid aria-hidden className="size-3.5" />
      </DragHandleButton>
      <button
        type="button"
        title={t('feed.rowTitle', { context: focus, title: feed.title, state: stateLabel })}
        aria-label={t('feed.rowLabel', { context: focus, title: feed.title, state: stateLabel })}
        data-visibility={state}
        onClick={() => onSetVisibility([feed], toggleFocus(state))}
        onContextMenu={(event) => {
          event.preventDefault();
          ipc.send('feeds:show-feed-context-menu', feed.id);
        }}
        className={cx(
          "flex min-w-0 flex-1 items-center gap-2.25 rounded-xl px-2.25 py-1.5 text-start text-sm hover:bg-primary_hover",
          state === "only" && "bg-primary_hover font-semibold text-primary",
          state === "hidden" && "text-quaternary opacity-60",
          state === "home" && "text-secondary",
        )}
      >
        <FeedAvatar title={feed.title} faviconUrl={feed.icon} size="sm" />
        <span className="min-w-0 flex-1 truncate">{feed.title}</span>
        {feed.last_error && <span role="img" aria-label={t('feed.refreshFailedLabel', { title: feed.title, error: feed.last_error })} title={t('feed.refreshFailedTitle', { error: feed.last_error })} className="text-warning-primary">!</span>}
      </button>
      <button
        type="button"
        title={t('feed.visibility', { context: hide, title: feed.title })}
        aria-label={t('feed.visibility', { context: hide, title: feed.title })}
        onClick={() => onSetVisibility([feed], toggleHidden(state))}
        className={cx(
          "flex flex-none items-center justify-center rounded-md text-quaternary hover:text-secondary",
          state === "hidden" ? EYE_SLOT_CLASSES : cx(COLLAPSED, "h-5.5 group-hover/row:w-5.5 group-hover/row:opacity-100 focus-visible:w-5.5"),
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
  const { t } = useTranslation('river');
  const state = folderVisibility(feeds, showOnlyLinks);
  const focus = focusAction(state);
  const hide = hideAction(state);
  const HideIcon = state === "hidden" ? Eye : EyeOff;

  return (
    <>
      <button
        type="button"
        aria-label={t('folder.focus', { context: focus, name: folderName })}
        onClick={() => onSetVisibility(feeds, toggleFolderFocus(feeds, showOnlyLinks))}
        className={cx("flex-none", state === "only" ? "" : cx(COLLAPSED, "group-hover:w-auto group-hover:opacity-100"))}
      >
        <LayerSingle aria-hidden className="size-3.5 text-quaternary" />
      </button>
      <button
        type="button"
        aria-label={t('folder.visibility', { context: hide, name: folderName })}
        onClick={() => onSetVisibility(feeds, toggleFolderHidden(feeds, showOnlyLinks))}
        className={cx("flex-none", state === "hidden" ? "" : cx(COLLAPSED, "group-hover:w-auto group-hover:opacity-100"))}
      >
        <HideIcon aria-hidden className="size-3.5 text-quaternary" />
      </button>
    </>
  );
}
