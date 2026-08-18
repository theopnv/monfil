import { useCallback, useMemo, useRef, useState } from "react";
import RiverControls from "@/components/Home/RiverControls";
import RiverHeader from "@/components/Home/RiverHeader";
import RiverList from "@/components/Home/RiverList";
import RiverSidebar from "@/components/Home/RiverSidebar";
import { type FeedVisibility, visibleFeedLinks } from "@/lib/feed-visibility";
import { openLink, toRiverItems } from "@/lib/river";
import { useMarkReadOnScroll } from "@/lib/useMarkReadOnScroll";
import { useFeeds, useReadState, useSetShowInHome } from "@/providers/feeds-provider";
import { usePreferences } from "@/providers/preferences-provider";
import type { Feed } from "../../../preload/channels";

export interface RiverProps {
  onOpenItem: (id: number) => void;
}

export default function River({ onOpenItem }: RiverProps) {
  const feeds = useFeeds();
  const { isRead, markRead, markAllRead } = useReadState();
  const setShowInHome = useSetShowInHome();
  const { preferences } = usePreferences();
  const riverItems = useMemo(() => toRiverItems(feeds), [feeds]);
  const scrollRef = useRef<HTMLDivElement>(null);

  const [showOnlyLinks, setShowOnlyLinks] = useState<ReadonlySet<string>>(() => new Set());

  const visibleItems = useMemo(() => {
    const links = visibleFeedLinks(feeds, showOnlyLinks);
    const inHome = riverItems.filter((item) => links.has(item.feedLink));
    return preferences.hideReadItems ? inHome.filter((item) => !isRead(item.id)) : inHome;
  }, [riverItems, feeds, showOnlyLinks, preferences.hideReadItems, isRead]);

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
      if (!prev.has(feed.link)) return prev;
      const next = new Set(prev);
      next.delete(feed.link);
      return next;
    });
  }, []);

  const handleMarkAllRead = () => markAllRead(visibleItems.map((item) => item.id));

  const unreadCount = visibleItems.filter((item) => !isRead(item.id)).length;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <RiverSidebar
        feeds={feeds}
        showOnlyLinks={showOnlyLinks}
        onSetVisibility={applyVisibility}
        onFeedDeleted={handleFeedDeleted}
      />

      <div className="flex flex-1 flex-col overflow-hidden">
        <RiverHeader />
        <RiverControls
          unreadCount={unreadCount}
          sourceCount={feeds.length}
          onMarkAllRead={handleMarkAllRead}
        />

        <div ref={scrollRef} className="flex-1 overflow-y-auto px-8.5 py-6.5 pb-20">
          <div className="mx-auto max-w-[860px]">
            <RiverList items={visibleItems} density={preferences.density} isRead={isRead} onOpen={handleOpen} />
          </div>
        </div>
      </div>
    </div>
  );
}
