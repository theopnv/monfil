import RiverCardArticle from "@/components/Home/RiverCardArticle";
import RiverCardCompact from "@/components/Home/RiverCardCompact";
import RiverCardMagazine from "@/components/Home/RiverCardMagazine";
import type { Density, RiverItem } from "@/lib/river";

export interface RiverListProps {
  items: RiverItem[];
  density: Density;
  isRead: (id: number) => boolean;
  onOpen: (id: number) => void;
}

export default function RiverList({ items, density, isRead, onOpen }: RiverListProps) {
  if (density === "Magazine") {
    return (
      <div className="grid grid-cols-2 gap-3.5">
        {items.map((item) => (
          <RiverCardMagazine key={item.id} item={item} read={isRead(item.id)} onOpen={onOpen} />
        ))}
      </div>
    );
  }

  if (density === "Compact") {
    return (
      <div className="overflow-hidden rounded-xl border border-secondary bg-primary">
        {items.map((item) => (
          <RiverCardCompact key={item.id} item={item} read={isRead(item.id)} onOpen={onOpen} />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3.5">
      {items.map((item) => (
        <RiverCardArticle key={item.id} item={item} read={isRead(item.id)} onOpen={onOpen} />
      ))}
    </div>
  );
}
