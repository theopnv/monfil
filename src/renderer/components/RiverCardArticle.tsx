import { Bookmark } from "@untitledui/icons";
import FeedAvatar from "@/components/FeedAvatar";
import { Badge } from "@/components/untitled-ui/base/badges/badges";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { cx } from "@/components/untitled-ui/utils/cx";
import { estimateReadTime, formatRelativeTime, openLink, type RiverCardProps } from "@/lib/river";

export default function RiverCardArticle({ item, read, onToggleRead }: RiverCardProps) {
  return (
    <article
      onClick={() => {
        openLink(item.link);
        onToggleRead(item.id);
      }}
      className={cx(
        "flex cursor-pointer gap-4.5 rounded-xl border border-secondary bg-primary p-5 transition hover:border-brand hover:shadow-md",
        read && "opacity-50",
      )}
    >
      <div className="min-w-0 flex-1">
        <div className="mb-2.25 flex items-center gap-2">
          <FeedAvatar title={item.feedTitle} size="md" />
          <span className="text-sm font-bold text-primary">{item.feedTitle}</span>
          <span className="text-sm text-quaternary">{formatRelativeTime(item.pubDate)}</span>
          <Badge color="brand" size="sm">
            RSS
          </Badge>
        </div>

        <h4 className="mb-1.75 text-lg leading-tight font-bold text-pretty text-primary">{item.title}</h4>
        {item.description && <p className="text-sm leading-relaxed text-pretty text-tertiary">{item.description}</p>}

        <div className="mt-3.25 flex items-center gap-2">
          {item.description && <span className="text-xs text-quaternary">{estimateReadTime(item.description)}</span>}
          <span className="size-0.75 flex-none rounded-full bg-quaternary" />
          <span className="rounded-full bg-sage-200 px-2.5 py-0.75 text-xs font-semibold text-sage-800">{item.categoryName}</span>
          <Button
            aria-label="Save"
            color="tertiary"
            size="sm"
            className="ml-auto rounded-full"
            iconLeading={Bookmark}
            // react-aria's Button stops the press event from bubbling to the
            // card's onClick by default, so this never toggles read state.
            onPress={() => {}}
          />
        </div>
      </div>

      <div className="flex h-28 w-37.5 flex-none items-center justify-center rounded-lg bg-brand-secondary bg-[repeating-linear-gradient(118deg,transparent_0_9px,color-mix(in_srgb,var(--color-brand-500)_22%,transparent)_9px_18px)]">
        <span className="rounded-full bg-primary px-1.5 py-0.5 font-mono text-[9.5px] text-brand-tertiary">article image</span>
      </div>
    </article>
  );
}
