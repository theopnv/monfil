import { EyeOff, LayersThree01, LayerSingle } from "@untitledui/icons";
import type { FC } from "react";
import type { FeedSummary } from "../../../preload/channels";

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

/** home -> only -> hidden -> home. A `mixed` folder resets to `home`. */
export function nextVisibility(current: FeedVisibility | "mixed"): FeedVisibility {
  switch (current) {
    case "home":
      return "only";
    case "only":
      return "hidden";
    case "hidden":
      return "home";
    case "mixed":
      return "home";
  }
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

export const VISIBILITY_LABEL: Record<FeedVisibility, string> = {
  home: "Show with others",
  only: "Show only",
  hidden: "Hide",
};

/** Describes the current state, unlike `VISIBILITY_LABEL`, which names the action a control performs next. */
export const VISIBILITY_STATE_LABEL: Record<FeedVisibility, string> = {
  home: "Shown with others",
  only: "Shown only",
  hidden: "Hidden",
};

export const VISIBILITY_ICON: Record<FeedVisibility, FC<{ className?: string; "aria-hidden"?: boolean }>> = {
  home: LayersThree01,
  only: LayerSingle,
  hidden: EyeOff,
};
