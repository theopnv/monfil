import FeedAvatar from "@/components/Home/FeedAvatar";
import RiverCardImage from "@/components/Home/RiverCardImage";
import { Badge } from "@/components/untitled-ui/base/badges/badges";
import { cx } from "@/components/untitled-ui/utils/cx";
import { getFaviconUrl } from "@/lib/favicon";
import { formatRelativeTime, type RiverCardProps } from "@/lib/river/utils";

export default function RiverCardMagazine({ item, read, onOpen }: RiverCardProps) {
  return (
    <article
      data-item-id={item.id}
      onClick={() => onOpen(item.id)}
      className={cx(
        "flex cursor-pointer flex-col overflow-hidden rounded-xl border border-secondary bg-primary transition hover:border-brand hover:shadow-md",
        read && "opacity-50",
      )}
    >
      <RiverCardImage src={item.image} className="h-33 w-full" />

      <div className="flex flex-1 flex-col p-4.25">
        <div className="mb-2 flex items-center gap-1.75">
          <FeedAvatar title={item.feedTitle} faviconUrl={getFaviconUrl(item.feedLink)} size="sm" />
          <span className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-primary">{item.feedTitle}</span>
          <span className="ml-auto flex-none text-xs text-quaternary">{formatRelativeTime(item.pubDate)}</span>
        </div>

        <h4 className="mb-1.75 text-base leading-snug font-bold text-pretty text-primary">{item.title}</h4>
        {item.description && <p className="text-sm leading-snug text-pretty text-tertiary">{item.description}</p>}

        <div className="mt-auto flex items-center gap-2 pt-3">
          <span className="rounded-full bg-sage-200 px-2.25 py-0.5 text-xs font-semibold text-sage-800">{item.categoryName}</span>
          <Badge color="brand" size="sm">
            RSS
          </Badge>
        </div>
      </div>
    </article>
  );
}
