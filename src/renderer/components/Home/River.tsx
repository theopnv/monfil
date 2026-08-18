import { useCallback, useMemo, useState } from "react";
import RiverControls, { type Density } from "@/components/Home/RiverControls";
import RiverHeader from "@/components/Home/RiverHeader";
import RiverList from "@/components/Home/RiverList";
import RiverSidebar from "@/components/Home/RiverSidebar";
import { type FeedVisibility, visibleFeedLinks } from "@/lib/feed-visibility";
import { toRiverItems } from "@/lib/river";
import { useFeeds, useReadState, useSetShowInHome } from "@/providers/feeds-provider";
import type { Feed } from "../../../preload/channels";

export interface RiverProps {
  onOpenItem: (id: number) => void;
}

export default function River({ onOpenItem }: RiverProps) {
  const feeds = useFeeds();
  const { isRead, markRead } = useReadState();
  const setShowInHome = useSetShowInHome();
  const riverItems = useMemo(() => toRiverItems(feeds), [feeds]);

  const [density, setDensity] = useState<Density>("Cards");
  const [showOnlyLinks, setShowOnlyLinks] = useState<ReadonlySet<string>>(() => new Set());

  const visibleItems = useMemo(() => {
    const links = visibleFeedLinks(feeds, showOnlyLinks);
    return riverItems.filter((item) => links.has(item.feedLink));
  }, [riverItems, feeds, showOnlyLinks]);

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

  const markAllRead = () => {
    for (const item of visibleItems) {
      markRead(item.id);
    }
  };

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
          density={density}
          onDensityChange={setDensity}
          unreadCount={unreadCount}
          sourceCount={feeds.length}
          onMarkAllRead={markAllRead}
        />

        <div className="flex-1 overflow-y-auto px-8.5 py-6.5 pb-20">
          <div className="mx-auto max-w-[860px]">
            <RiverList items={visibleItems} density={density} isRead={isRead} onOpen={onOpenItem} />
          </div>
        </div>
      </div>
    </div>
  );
}
