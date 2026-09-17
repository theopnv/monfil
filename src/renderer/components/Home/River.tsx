import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyRiver from "@/components/Home/EmptyRiver";
import RiverHeader from "@/components/Home/RiverHeader";
import RiverList from "@/components/Home/RiverList";
import RiverSidebar from "@/components/Home/RiverSidebar";
import ImportOpmlDialog from "@/components/Workspace/ImportOpmlDialog";
import { announce } from "@/lib/announcer";
import { type FeedVisibility } from "@/lib/river/feed-visibility";
import { openLink } from "@/lib/river/utils";
import { useLoadMoreOnScroll } from "@/lib/river/useLoadMoreOnScroll";
import { useMarkReadOnScroll } from "@/lib/river/useMarkReadOnScroll";
import { useRiverKeyboardNav } from "@/lib/river/useRiverKeyboardNav";
import { useRiverScope } from "@/lib/river/useRiverScope";
import { useCategories, useFeeds, useReadState, useRiver, useSetShowInWorkspace } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { useSearch } from "@/providers/search-provider";
import { useActiveWorkspace } from "@/providers/workspace-provider";
import type { FeedSummary } from "../../../preload/channels";

export interface RiverProps {
  onOpenItem: (id: number) => void;
}

export default function River({ onOpenItem }: RiverProps) {
  const feeds = useFeeds();
  const categories = useCategories();
  const { markRead, markAllRead } = useReadState();
  const setShowInWorkspace = useSetShowInWorkspace();
  const { preferences } = usePreferences();
  const { query: searchQuery, setQuery: setSearchQuery } = useSearch();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeWorkspace = useActiveWorkspace();
  const [isImportOpen, setIsImportOpen] = useState(false);

  const { scope, visibleFeedIdsSet, showOnlyLinks, setShowOnlyLinks, debouncedSearch } = useRiverScope(feeds);

  // The corpus-wide unread count of the visible feeds. Comes from FeedSummary.
  const unreadCount = useMemo(
    () => feeds.filter((feed) => visibleFeedIdsSet.has(feed.id)).reduce((sum, feed) => sum + feed.unreadCount, 0),
    [feeds, visibleFeedIdsSet],
  );

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage } = useRiver(scope);
  const visibleItems = useMemo(() => data?.pages.flatMap((page) => page.rows) ?? [], [data]);

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
  }, [setShowInWorkspace, setShowOnlyLinks]);

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
        categories={categories}
        showOnlyLinks={showOnlyLinks}
        onSetVisibility={applyVisibility}
        onFeedDeleted={handleFeedDeleted}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <RiverHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} hasFeeds={hasFeeds} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8.5 py-6.5 pb-20">
          <div className="mx-auto max-w-[860px]">
            {!hasFeeds ? (
              <EmptyRiver onImportOpml={() => setIsImportOpen(true)} />
            ) : debouncedSearch.length > 0 ? (
              visibleItems.length === 0
                ? <p className="py-20 text-center text-md font-regular text-tertiary">No results for &quot;{debouncedSearch}&quot;</p>
                : <RiverList items={visibleItems} density={preferences.density} onOpen={handleOpen} />
            ) : unreadCount === 0 ? (
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
    </div>
  );
}
