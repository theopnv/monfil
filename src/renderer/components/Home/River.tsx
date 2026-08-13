import { useMemo, useState } from "react";
import RiverControls, { type Density } from "@/components/Home/RiverControls";
import RiverHeader from "@/components/Home/RiverHeader";
import RiverList from "@/components/Home/RiverList";
import RiverSidebar from "@/components/Home/RiverSidebar";
import { toRiverItems } from "@/lib/river";
import { useFeeds } from "@/providers/feeds-provider";

export default function River() {
  const feeds = useFeeds();
  const riverItems = useMemo(() => toRiverItems(feeds), [feeds]);

  const [density, setDensity] = useState<Density>("Cards");
  const [read, setRead] = useState<Record<number, boolean>>({});
  const [selectedFeedLink, setSelectedFeedLink] = useState<string | null>(null);

  const visibleItems = useMemo(
    () => (selectedFeedLink ? riverItems.filter((item) => item.feedLink === selectedFeedLink) : riverItems),
    [riverItems, selectedFeedLink],
  );

  const isRead = (id: number) => !!read[id];
  const toggleRead = (id: number) => setRead((prev) => ({ ...prev, [id]: !prev[id] }));
  const markAllRead = () => {
    setRead((prev) => ({
      ...prev,
      ...visibleItems.reduce<Record<number, boolean>>((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {}),
    }));
  };

  const unreadCount = visibleItems.filter((item) => !isRead(item.id)).length;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <RiverSidebar feeds={feeds} selectedFeedLink={selectedFeedLink} onSelectFeed={setSelectedFeedLink} />

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
            <RiverList items={visibleItems} density={density} isRead={isRead} onToggleRead={toggleRead} />
          </div>
        </div>
      </div>
    </div>
  );
}
