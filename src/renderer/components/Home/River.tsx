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

  const isRead = (id: number) => !!read[id];
  const toggleRead = (id: number) => setRead((prev) => ({ ...prev, [id]: !prev[id] }));
  const markAllRead = () => {
    setRead(
      riverItems.reduce<Record<number, boolean>>((acc, item) => {
        acc[item.id] = true;
        return acc;
      }, {}),
    );
  };

  const unreadCount = riverItems.filter((item) => !isRead(item.id)).length;

  return (
    <div className="flex h-full w-full overflow-hidden">
      <RiverSidebar feeds={feeds} />

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
            <RiverList items={riverItems} density={density} isRead={isRead} onToggleRead={toggleRead} />
          </div>
        </div>
      </div>
    </div>
  );
}
