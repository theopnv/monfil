import FeedAvatar from "@/components/Home/FeedAvatar";
import { cx } from "@/components/untitled-ui/utils/cx";
import { getFaviconUrl } from "@/lib/favicon";
import { formatRelativeTime, openLink, type RiverCardProps } from "@/lib/river";

export default function RiverCardCompact({ item, read, onToggleRead }: RiverCardProps) {
  return (
    <div
      onClick={() => {
        openLink(item.link);
        onToggleRead(item.id);
      }}
      className={cx(
        "flex cursor-pointer items-center gap-3 border-b border-secondary px-4 py-2.75 transition last:border-b-0 hover:bg-brand-secondary",
        read && "opacity-50",
      )}
    >
      <span className={cx("size-1.75 flex-none rounded-full", read ? "bg-quaternary" : "bg-brand-solid")} />
      <FeedAvatar title={item.feedTitle} faviconUrl={getFaviconUrl(item.feedLink)} size="sm" />
      <span className="w-33 flex-none overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-primary">{item.feedTitle}</span>
      <span className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-secondary">{item.title}</span>
      <span className="flex-none rounded-full bg-sage-200 px-2 py-0.5 text-xs font-semibold text-sage-800">{item.categoryName}</span>
      <span className="flex-none text-xs font-bold tracking-wide text-quaternary">RSS</span>
      <span className="w-13 flex-none text-right text-xs text-quaternary tabular-nums">{formatRelativeTime(item.pubDate)}</span>
    </div>
  );
}
