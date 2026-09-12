import { useCallback, useMemo, useRef, useState } from "react";
import RiverHeader from "@/components/Home/RiverHeader";
import RiverList from "@/components/Home/RiverList";
import RiverSidebar from "@/components/Home/RiverSidebar";
import { type FeedVisibility, visibleFeedLinks } from "@/lib/river/feed-visibility";
import { filterBySearch } from "@/lib/river/search";
import { openLink, toRiverItems } from "@/lib/river/utils";
import { useMarkReadOnScroll } from "@/lib/river/useMarkReadOnScroll";
import { useDebouncedValue } from "@/lib/useDebouncedValue";
import { useFeeds, useReadState, useSetShowInHome } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import { useSearch } from "@/providers/search-provider";
import type { Feed } from "../../../preload/channels";

export interface RiverProps {
  onOpenItem: (id: number) => void;
}

export default function River({ onOpenItem }: RiverProps) {
  const feeds = useFeeds();
  const { isRead, markRead, markAllRead } = useReadState();
  const setShowInHome = useSetShowInHome();
  const { preferences } = usePreferences();
  const { query: searchQuery, setQuery: setSearchQuery } = useSearch();
  const debouncedSearch = useDebouncedValue(searchQuery.trim(), 250);
  const riverItems = useMemo(() => toRiverItems(feeds), [feeds]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showOnlyLinks, setShowOnlyLinks] = useState<ReadonlySet<string>>(() => new Set());

  // The feeds currently shown in home (respecting solo/hide), independent of
  // the transient search query and hideReadItems toggle.
  const visibleFeedLinksSet = useMemo(() => visibleFeedLinks(feeds, showOnlyLinks), [feeds, showOnlyLinks]);
  const inHomeItems = useMemo(() => riverItems.filter((item) => visibleFeedLinksSet.has(item.feedLink)), [riverItems, visibleFeedLinksSet]);

  const visibleItems = useMemo(() => {
    const shown = preferences.hideReadItems ? inHomeItems.filter((item) => !isRead(item.id)) : inHomeItems;
    return filterBySearch(shown, debouncedSearch);
  }, [inHomeItems, preferences.hideReadItems, isRead, debouncedSearch]);

  useMarkReadOnScroll(scrollRef, preferences.markReadOnScroll, markAllRead);

  const handleOpen = useCallback((id: number) => {
    const item = visibleItems.find((candidate) => candidate.id === id);
    if (preferences.openLinksExternally && item?.link) {
      openLink(item.link);
      markRead(id);
      return;
    }
    onOpenItem(id);
  }, [visibleItems, preferences.openLinksExternally, markRead, onOpenItem]);

  const applyVisibility = useCallback(async (targets: Feed[], target: FeedVisibility) => {
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

    const needsWrite = targets.filter((feed) => (feed.showInHome !== 0) === (target === "hidden"));
    if (needsWrite.length > 0) {
      await setShowInHome(needsWrite.map((feed) => feed.id), target !== "hidden");
    }
  }, [setShowInHome]);

  const handleFeedDeleted = useCallback((feed: Feed) => {
    setShowOnlyLinks((prev) => {
      if (!prev.has(feed.link)) {
        return prev;
      }
      const next = new Set(prev);
      next.delete(feed.link);
      return next;
    });
  }, []);

  return (
    <div className="flex h-full w-full overflow-hidden">
      <RiverSidebar
        feeds={feeds}
        showOnlyLinks={showOnlyLinks}
        onSetVisibility={applyVisibility}
        onFeedDeleted={handleFeedDeleted}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <RiverHeader searchQuery={searchQuery} onSearchChange={setSearchQuery} />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8.5 py-6.5 pb-20">
          <div className="mx-auto max-w-[860px]">
            {visibleItems.length === 0 && debouncedSearch.length > 0
              ? <p className="py-20 text-center text-md font-regular text-tertiary">No results for &quot;{debouncedSearch}&quot;</p>
              : visibleItems.length === 0 && preferences.hideReadItems
                ? <p className="py-20 text-center text-md font-regular text-tertiary">You&apos;re all caught up</p>
                : <RiverList items={visibleItems} density={preferences.density} isRead={isRead} onOpen={handleOpen} />}
          </div>
        </div>
      </div>
    </div>
  );
}
