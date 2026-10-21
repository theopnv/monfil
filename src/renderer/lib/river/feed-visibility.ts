// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { FeedSummary } from "../../../shared/contracts";

export type FeedVisibility = "home" | "only" | "hidden";

/** `hidden` wins over `only`, so the two stores can never disagree. */
export function feedVisibility(feed: FeedSummary, showOnlyLinks: ReadonlySet<string>): FeedVisibility {
  if (feed.showInWorkspace === 0) {
    return "hidden";
  }
  if (showOnlyLinks.has(feed.link)) {
    return "only";
  }
  return "home";
}

/** A click on a feed row. `only` returns to `home`; any other state, including `hidden`, becomes `only`. */
export function toggleFocus(current: FeedVisibility | "mixed"): FeedVisibility {
  return current === "only" ? "home" : "only";
}

/** A click on a feed's eye. `hidden` returns to `home`; any other state becomes `hidden`. */
export function toggleHidden(current: FeedVisibility | "mixed"): FeedVisibility {
  return current === "hidden" ? "home" : "hidden";
}

/** The shared state of a folder's feeds, or `mixed`. An empty folder is `home`. */
export function folderVisibility(feeds: FeedSummary[], showOnlyLinks: ReadonlySet<string>): FeedVisibility | "mixed" {
  if (feeds.length === 0) {
    return "home";
  }
  const [first, ...rest] = feeds;
  if (!first) {
    return "home";
  }
  const state = feedVisibility(first, showOnlyLinks);
  return rest.every((feed) => feedVisibility(feed, showOnlyLinks) === state) ? state : "mixed";
}

/** Ids whose items belong in home: the `only` feeds if any exist, otherwise every non-`hidden` feed. */
export function visibleFeedIds(feeds: FeedSummary[], showOnlyLinks: ReadonlySet<string>): Set<number> {
  const onlyFeeds = feeds.filter((feed) => feedVisibility(feed, showOnlyLinks) === "only");
  if (onlyFeeds.length > 0) {
    return new Set(onlyFeeds.map((feed) => feed.id));
  }
  return new Set(feeds.filter((feed) => feed.showInWorkspace !== 0).map((feed) => feed.id));
}

/** The focus state a folder's focus button moves every feed to: cleared when all of them are focused already. */
export function toggleFolderFocus(feeds: FeedSummary[], showOnlyLinks: ReadonlySet<string>): FeedVisibility {
  return toggleFocus(folderVisibility(feeds, showOnlyLinks));
}

/** The state a folder's eye moves every feed to: cleared when all of them are hidden already. */
export function toggleFolderHidden(feeds: FeedSummary[], showOnlyLinks: ReadonlySet<string>): FeedVisibility {
  return toggleHidden(folderVisibility(feeds, showOnlyLinks));
}

/** Names the action of the focus control, which flips with the state it would clear. */
export function focusActionLabel(current: FeedVisibility | "mixed"): "Focus" | "Unfocus" {
  return current === "only" ? "Unfocus" : "Focus";
}

/** Names the action of the eye control. */
export function hideActionLabel(current: FeedVisibility | "mixed"): "Hide" | "Show" {
  return current === "hidden" ? "Show" : "Hide";
}

/** Describes the current state, unlike the action labels, which name what a control does next. */
export const VISIBILITY_STATE_LABEL: Record<FeedVisibility, string> = {
  home: "Shown with others",
  only: "Shown only",
  hidden: "Hidden",
};
