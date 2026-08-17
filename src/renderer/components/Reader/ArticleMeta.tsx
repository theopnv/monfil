import { Badge } from "@/components/untitled-ui/base/badges/badges";
import { estimateReadTime, formatRelativeTime } from "@/lib/river";
import type { RiverItem } from "@/lib/river";

export interface ArticleMetaProps {
  item: RiverItem;
}

export default function ArticleMeta({ item }: ArticleMetaProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.25">
      <Badge color="brand" size="sm">
        RSS ARTICLE
      </Badge>
      <span className="text-sm text-tertiary">
        {item.feedTitle} · {formatRelativeTime(item.pubDate)} · {estimateReadTime(item.description)}
      </span>
    </div>
  );
}
