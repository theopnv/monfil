import { ArrowRight } from "@untitledui/icons";
import { estimateReadTime, formatRelativeTime } from "@/lib/river/utils";
import type { RiverItem } from "@/lib/river/utils";

export interface NextArticleCardProps {
  item: RiverItem;
  label: "Next unread" | "Next article";
  onClick: () => void;
}

export default function NextArticleCard({ item, label, onClick }: NextArticleCardProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8.5 flex w-full items-center gap-4.5 rounded-xl border border-secondary p-5.5 text-left transition hover:border-brand hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.75 text-xs font-bold tracking-wide text-quaternary uppercase">{label}</div>
        <div className="mb-1.25 text-lg leading-tight font-bold text-pretty text-primary">{item.title}</div>
        <div className="text-sm text-tertiary">
          {item.feedTitle} · {estimateReadTime(item.description)} · {formatRelativeTime(item.pubDate)}
        </div>
      </div>
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-brand-secondary text-brand-tertiary">
        <ArrowRight className="size-4.5" />
      </span>
    </button>
  );
}
