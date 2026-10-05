// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { Button } from "@/components/untitled-ui/base/buttons/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyRiver from "@/components/Home/EmptyRiver";
import RiverHeader from "@/components/Home/RiverHeader";
import RiverList from "@/components/Home/RiverList";
import RiverSidebar from "@/components/Home/RiverSidebar";
import ImportOpmlDialog from "@/components/Workspace/ImportOpmlDialog";
import FeedpackInstallDialog from '@/components/Feedpacks/FeedpackInstallDialog';
import { announce } from "@/lib/announcer";
import { useFeedpackRefreshing } from '@/lib/ipc-bridge';
import { type FeedVisibility } from "@/lib/river/feed-visibility";
import { openLink } from "@/lib/river/utils";
import { useLoadMoreOnScroll } from "@/lib/river/useLoadMoreOnScroll";
import { useMarkReadOnScroll } from "@/lib/river/useMarkReadOnScroll";
import { useRiverKeyboardNav } from "@/lib/river/useRiverKeyboardNav";
import { useRiverScope } from "@/lib/river/useRiverScope";
import { useCategories, useFeeds, useReadState, useRiver, useSetShowInWorkspace } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { useSearch } from "@/providers/search-provider";
import { useActiveWorkspace, useActiveWorkspaceId } from "@/providers/workspace-provider";
import type { FeedSummary } from "../../../shared/contracts";

export interface RiverProps {
  onOpenItem: (id: number) => void;
  savedView?: boolean;
  onShowFeed?: () => void;
}

export default function River({ onOpenItem, savedView = false, onShowFeed }: RiverProps) {
  const feeds = useFeeds();
  const categories = useCategories();
  const { markRead, markAllRead } = useReadState();
  const setShowInWorkspace = useSetShowInWorkspace();
  const { preferences } = usePreferences();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeWorkspace = useActiveWorkspace();
  const activeWorkspaceId = useActiveWorkspaceId();
  const isFeedpackRefreshing = useFeedpackRefreshing(activeWorkspace?.id);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isFeedpackBrowserOpen, setIsFeedpackBrowserOpen] = useState(false);

  const { scope, visibleFeedIdsSet, showOnlyLinks, setShowOnlyLinks, debouncedSearch } = useRiverScope(feeds, savedView);
  const { query: searchQuery, setQuery: setSearchQuery } = useSearch(savedView);

  // The corpus-wide unread count of the visible feeds. Comes from FeedSummary.
  const unreadCount = useMemo(
    () => feeds.filter((feed) => visibleFeedIdsSet.has(feed.id)).reduce((sum, feed) => sum + feed.unreadCount, 0),
    [feeds, visibleFeedIdsSet],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isPending, isError, refetch } = useRiver(scope);
  const visibleItems = useMemo(() => (data?.pages.flatMap((page) => page.rows) ?? []).filter((item) => !savedView || item.savedAt != null), [data, savedView]);

  const loadMore = useCallback(() => {
    void fetchNextPage();
  }, [fetchNextPage]);
  useLoadMoreOnScroll(scrollRef, loadMore, !!hasNextPage && !isFetchingNextPage);
  useMarkReadOnScroll(scrollRef, preferences.markReadOnScroll, markAllRead);
  useRiverKeyboardNav(scrollRef, preferences.keyboardNavigation);

  useEffect(() => {
    if (debouncedSearch.length === 0) {
      return;
    }
    const count = visibleItems.length;
    announce(count === 0 ? `No results for "${debouncedSearch}"` : `${count} result${count === 1 ? '' : 's'} for "${debouncedSearch}"`);
  }, [debouncedSearch, visibleItems.length]);

  const handleOpen = useCallback((id: number) => {
    const item = visibleItems.find((candidate) => candidate.id === id);
    if (preferences.openLinksExternally && item?.link) {
      openLink(item.link);
      markRead(id);
      return;
    }
    onOpenItem(id);
  }, [visibleItems, preferences.openLinksExternally, markRead, onOpenItem]);

  const applyVisibility = useCallback(async (targets: FeedSummary[], target: FeedVisibility) => {
    if (savedView) {
      onShowFeed?.();
    }
    setShowOnlyLinks((prev) => {
      const next = new Set(prev);
      for (const feed of targets) {
        if (target === "only") {
          next.add(feed.link);
        } else {
          next.delete(feed.link);
        }
      }
      return next;
    });

    const needsWrite = targets.filter((feed) => (feed.showInWorkspace !== 0) === (target === "hidden"));
    if (needsWrite.length > 0) {
      await setShowInWorkspace(needsWrite.map((feed) => feed.id), target !== "hidden");
    }
  }, [setShowInWorkspace, setShowOnlyLinks, savedView, onShowFeed]);

  const handleFeedDeleted = useCallback((feed: FeedSummary) => {
    setShowOnlyLinks((prev) => {
      if (!prev.has(feed.link)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(feed.link);
      return next;
    });
  }, [setShowOnlyLinks]);

  const hasFeeds = feeds.length > 0;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <RiverSidebar
        feeds={feeds}
        savedView={savedView}
        categories={categories}
        showOnlyLinks={showOnlyLinks}
        onSetVisibility={applyVisibility}
        onFeedDeleted={handleFeedDeleted}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <RiverHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} hasFeeds={hasFeeds} savedView={savedView} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8.5 py-6.5 pb-20">
          <div className="mx-auto max-w-[860px]">
            {savedView && isPending ? (
              <p className="py-20 text-center text-tertiary">Loading saved items…</p>
            ) : savedView && isError ? (
              <div className="py-20 text-center">
                <p className="mb-3 text-tertiary">Saved items could not be loaded.</p>
                <Button color="secondary" onPress={() => {
                  void refetch();
                }}>Try again</Button>
              </div>
            ) : savedView && debouncedSearch.length === 0 ? (
              visibleItems.length === 0
                ? <p className="py-20 text-center text-md text-tertiary">Save items from your feeds to find them here.</p>
                : <RiverList items={visibleItems} density={preferences.density} onOpen={handleOpen} />
            ) : !savedView && isFeedpackRefreshing ? (
              <p className="py-20 text-center text-md font-regular text-tertiary">Fetching sources for this feedpack…</p>
            ) : !savedView && !hasFeeds ? (
              <EmptyRiver onImportOpml={() => setIsImportOpen(true)} onImportFeedpack={() => setIsFeedpackBrowserOpen(true)} />
            ) : debouncedSearch.length > 0 ? (
              visibleItems.length === 0
                ? <p className="py-20 text-center text-md font-regular text-tertiary">No results for &quot;{debouncedSearch}&quot;</p>
                : <RiverList items={visibleItems} density={preferences.density} onOpen={handleOpen} />
            ) : !savedView && unreadCount === 0 ? (
              <p className="py-20 text-center text-md font-regular text-tertiary">You&apos;re all caught up</p>
            ) : (
              <RiverList items={visibleItems} density={preferences.density} onOpen={handleOpen} />
            )}
          </div>
        </div>
      </div>

      {activeWorkspace && (
        <ImportOpmlDialog isOpen={isImportOpen} onOpenChange={setIsImportOpen} workspace={{ id: activeWorkspace.id, name: activeWorkspace.name }} />
      )}
      <FeedpackInstallDialog isOpen={isFeedpackBrowserOpen} onOpenChange={setIsFeedpackBrowserOpen} workspaceId={activeWorkspaceId} />
    </div>
  );
}
