import { Badge } from "@/components/untitled-ui/base/badges/badges";
import { estimateReadTime, formatRelativeTime, SOURCE_TYPE_LABEL } from "@/lib/river/utils";
import type { RiverItem } from "@/lib/river/utils";

export interface ArticleMetaProps {
  item: RiverItem;
  wordCount: number | undefined;
}

export default function ArticleMeta({ item, wordCount }: ArticleMetaProps) {
  const readTime = wordCount === undefined ? undefined : estimateReadTime(wordCount);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.25">
      <Badge color="brand" size="sm">
        {SOURCE_TYPE_LABEL[item.type]}
      </Badge>
      <span className="text-sm text-tertiary">
        {item.feedTitle} · {formatRelativeTime(item.pubDate)}
        {readTime && <> · {readTime}</>}
      </span>
    </div>
  );
}
