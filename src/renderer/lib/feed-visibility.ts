import { EyeOff, LayersThree01, LayerSingle } from "@untitledui/icons";
import type { FC } from "react";
import type { Feed } from "../../preload/channels";

export type FeedVisibility = "home" | "only" | "hidden";

/** `hidden` wins over `only`, so the two stores can never disagree. */
export function feedVisibility(feed: Feed, showOnlyLinks: ReadonlySet<string>): FeedVisibility {
  if (feed.showInHome === 0) return "hidden";
  if (showOnlyLinks.has(feed.link)) return "only";
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
export function folderVisibility(feeds: Feed[], showOnlyLinks: ReadonlySet<string>): FeedVisibility | "mixed" {
  if (feeds.length === 0) return "home";
  const [first, ...rest] = feeds;
  if (!first) return "home";
  const state = feedVisibility(first, showOnlyLinks);
  return rest.every((feed) => feedVisibility(feed, showOnlyLinks) === state) ? state : "mixed";
}

/** Links whose items belong in home: the `only` feeds if any exist, otherwise every non-`hidden` feed. */
export function visibleFeedLinks(feeds: Feed[], showOnlyLinks: ReadonlySet<string>): Set<string> {
  const onlyFeeds = feeds.filter((feed) => feedVisibility(feed, showOnlyLinks) === "only");
  if (onlyFeeds.length > 0) return new Set(onlyFeeds.map((feed) => feed.link));
  return new Set(feeds.filter((feed) => feed.showInHome !== 0).map((feed) => feed.link));
}

export const VISIBILITY_LABEL: Record<FeedVisibility, string> = {
  home: "Show with others",
  only: "Show only",
  hidden: "Hide",
};

export const VISIBILITY_ICON: Record<FeedVisibility, FC<{ className?: string; "aria-hidden"?: boolean }>> = {
  home: LayersThree01,
  only: LayerSingle,
  hidden: EyeOff,
};
