// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useEffect, useRef, type ReactNode } from "react";
import { RefreshCw01 } from "@untitledui/icons";
import { ToggleButton, ToggleButtonGroup } from "react-aria-components";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import RiverFilterStrip from "@/components/Home/RiverFilterStrip";
import RiverSearch from "@/components/Home/RiverSearch";
import { cx } from "@/components/untitled-ui/utils/cx";
import { announce } from "@/lib/announcer";
import { useApplyPendingRefresh, useHasPendingRefresh } from "@/lib/ipc-bridge";
import { useFeedsRefresh } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { useActiveWorkspace } from "@/providers/workspace-provider";
import type { FeedSummary } from "../../../shared/contracts";

const REFRESH_FAILED_MESSAGE = "Couldn't refresh feeds. Check your connection and try again.";

function ReadFilter({ unreadOnly, onChange }: { unreadOnly: boolean; onChange: (unreadOnly: boolean) => void }) {
  return (
    <ToggleButtonGroup
      aria-label="Items to show"
      selectionMode="single"
      disallowEmptySelection
      selectedKeys={[unreadOnly ? "unread" : "all"]}
      onSelectionChange={(keys) => onChange(keys.has("unread"))}
      className="flex flex-none rounded-full bg-secondary p-0.5 ring-1 ring-secondary ring-inset"
    >
      {[{ id: "all", label: "All" }, { id: "unread", label: "Unread" }].map(({ id, label }) => (
        <ToggleButton
          key={id}
          id={id}
          className={({ isSelected }) => cx(
            "rounded-full px-3.5 py-1.5 text-sm font-semibold outline-brand transition duration-100 ease-linear focus-visible:outline-2",
            isSelected ? "bg-primary text-secondary shadow-xs" : "text-quaternary hover:text-tertiary",
          )}
        >
          {label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

export interface RiverHeaderProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  hasFeeds: boolean;
  /** The feeds the river shows, so the Refresh pill only appears for items that will land in it. */
  visibleFeedIds: ReadonlySet<number>;
  /** Called after the Refresh pill loads the new items into the river. */
  onPendingApplied?: () => void;
  savedView?: boolean;
  /** The active workspace's feeds, for the strip that explains an active filter. */
  feeds: FeedSummary[];
  showOnlyLinks: ReadonlySet<string>;
  onClearFocus: () => void;
  onShowHidden: (feedIds: number[]) => void;
  /** Controls shown beside the search box, such as saving the search. */
  searchActions?: ReactNode;
}

export default function RiverHeader({ searchQuery, onSearchChange, hasFeeds, visibleFeedIds, onPendingApplied, savedView = false, feeds, showOnlyLinks, onClearFocus, onShowHidden, searchActions }: RiverHeaderProps) {
  const { refreshNow, isRefreshing, refreshFailed } = useFeedsRefresh();
  const { preferences, setPreference } = usePreferences();
  const activeWorkspace = useActiveWorkspace();
  const hasPendingRefresh = useHasPendingRefresh(visibleFeedIds) && !savedView && !isRefreshing;
  const applyPendingRefresh = useApplyPendingRefresh();

  const handlePendingClick = () => {
    applyPendingRefresh();
    onPendingApplied?.();
  };

  const hadPendingRefresh = useRef(false);
  useEffect(() => {
    if (hasPendingRefresh && !hadPendingRefresh.current) {
      announce("New articles available.");
    }
    hadPendingRefresh.current = hasPendingRefresh;
  }, [hasPendingRefresh]);

  const wasRefreshing = useRef(false);
  useEffect(() => {
    if (wasRefreshing.current && !isRefreshing) {
      announce(refreshFailed ? REFRESH_FAILED_MESSAGE : "Feeds refreshed.");
    }
    wasRefreshing.current = isRefreshing;
  }, [isRefreshing, refreshFailed]);

  return (
    <header className="flex flex-none flex-col border-b border-secondary px-8.5 py-4.5">
      <div className="mx-auto flex w-full max-w-[860px] flex-col gap-2">
        <div className="flex items-end gap-5">
          <div className="min-w-0 flex-1">
            {savedView && <div className="mb-1 text-xs font-semibold tracking-wide text-brand-secondary uppercase">{activeWorkspace?.name ?? "Home"}</div>}
            <h1 className="truncate font-display text-display-md leading-tight text-primary" title={savedView ? "Saved" : activeWorkspace?.name ?? "Home"}>{savedView ? "Saved" : activeWorkspace?.name ?? "Home"}</h1>
          </div>

          {(hasFeeds || savedView) && (
            <div className="flex flex-none items-center justify-end gap-2.5">
              <RiverSearch
                value={searchQuery}
                onChange={onSearchChange}
                placeholder={savedView ? "Search saved items" : "Search"}
                saveControl={searchActions}
              />
              {!savedView && <ReadFilter unreadOnly={preferences.hideReadItems} onChange={(unreadOnly) => setPreference("hideReadItems", unreadOnly)} />}
              {hasPendingRefresh && <Button
                aria-label="Refresh, new articles available"
                color="primary"
                iconLeading={RefreshCw01}
                className="flex-none rounded-full"
                onPress={handlePendingClick}
              >
                Refresh
              </Button>}
              {!savedView && !hasPendingRefresh && <Button
                aria-label="Refresh feeds"
                color="secondary"
                iconLeading={RefreshCw01}
                className="flex-none rounded-full"
                isLoading={isRefreshing}
                isDisabled={isRefreshing}
                onPress={refreshNow}
              />}
            </div>
          )}
        </div>

        {!savedView && <RiverFilterStrip feeds={feeds} showOnlyLinks={showOnlyLinks} onClearFocus={onClearFocus} onShowHidden={onShowHidden} />}

        {!savedView && hasFeeds && refreshFailed && <p className="text-right text-sm text-error-primary">{REFRESH_FAILED_MESSAGE}</p>}
      </div>
    </header>
  );
}
