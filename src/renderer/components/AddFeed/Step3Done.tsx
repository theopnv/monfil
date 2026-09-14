import { useMemo } from "react";
import { Check } from "@untitledui/icons";
import { formatRelativeTime } from "@/lib/river/utils";
import { useRiver } from "@/providers/feeds-provider";
import type { FeedSummary } from "../../../preload/channels";

export interface Step3DoneProps {
  feed: FeedSummary;
}

const PREVIEW_COUNT = 5;

export default function Step3Done({ feed }: Step3DoneProps) {
  const scope = useMemo(() => ({ feedIds: [feed.id] }), [feed.id]);
  const { data } = useRiver(scope);
  const items = useMemo(() => (data?.pages.flatMap((page) => page.rows) ?? []).slice(0, PREVIEW_COUNT), [data]);

  return (
    <div className="flex flex-col items-center px-7.5 py-6 text-center">
      <span className="mb-4.5 flex size-16.5 items-center justify-center rounded-full bg-success-secondary text-fg-success-primary">
        <Check className="size-7.5 stroke-[2.75px]" />
      </span>
      <h3 className="font-display text-display-xs leading-tight text-primary">
        {feed.title} is in {feed.category.name}
      </h3>
      <p className="mt-2 mb-5.5 max-w-[44ch] text-sm leading-relaxed text-tertiary text-pretty">
        Backfilled {feed.itemCount} item{feed.itemCount === 1 ? "" : "s"}. Everything stays on this machine.
      </p>

      {items.length > 0 && (
        <div className="w-full overflow-hidden rounded-xl border border-secondary text-left">
          {items.map((item, index, all) => (
            <div
              key={item.id}
              className={`flex items-center gap-2.75 px-3.75 py-2.75 text-sm ${index !== all.length - 1 ? "border-b border-secondary" : ""}`}
            >
              <span className="size-1.75 flex-none rounded-full bg-brand-solid" />
              <span className="min-w-0 flex-1 truncate text-secondary">{item.title}</span>
              <span className="flex-none text-xs text-tertiary">{formatRelativeTime(item.publishedAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
