import FeedAvatar from "@/components/Home/FeedAvatar";
import RiverCardImage from "@/components/Home/RiverCardImage";
import { cx } from "@/components/untitled-ui/utils/cx";
import { getFaviconUrl } from "@/lib/favicon";
import { describeRiverCard, estimateReadTime, formatRelativeTime, type RiverCardProps } from "@/lib/river/utils";

export default function RiverCardArticle({ item, read, onOpen }: RiverCardProps) {
  return (
    <article
      data-item-id={item.id}
      role="button"
      tabIndex={0}
      aria-label={describeRiverCard(item, read)}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item.id);
        }
      }}
      className={cx(
        "flex cursor-pointer gap-4.5 rounded-xl border border-secondary bg-primary p-5 transition hover:border-brand hover:shadow-md",
        read && "opacity-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2.25 flex items-center gap-2">
          <span aria-hidden className={cx("size-1.75 flex-none rounded-full", read ? "bg-quaternary" : "bg-brand-solid")} />
          <FeedAvatar title={item.feedTitle} faviconUrl={getFaviconUrl(item.feedLink)} size="md" />
          <span className="text-sm font-bold text-primary">{item.feedTitle}</span>
          <span className="text-sm text-tertiary">{formatRelativeTime(item.pubDate)}</span>
        </div>

        <h4 className="mb-1.75 text-lg leading-tight font-bold text-pretty text-primary">{item.title}</h4>
        {item.description && <p className="text-sm leading-relaxed text-pretty text-tertiary">{item.description}</p>}

        <div className="mt-3.25 flex items-center gap-2">
          {item.description && <span className="text-xs text-tertiary">{estimateReadTime(item.description)}</span>}
          <span className="size-0.75 flex-none rounded-full bg-quaternary" />
          <span className="rounded-full bg-sage-200 px-2.5 py-0.75 text-xs font-semibold text-sage-800">{item.categoryName}</span>
        </div>
      </div>

      <RiverCardImage src={item.image} className="h-28 w-37.5 flex-none rounded-lg" />
    </article>
  );
}
