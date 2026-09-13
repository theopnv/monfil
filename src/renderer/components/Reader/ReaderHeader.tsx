import { ArrowLeft, ChevronDown, ChevronUp, Circle } from "@untitledui/icons";
import FeedAvatar from "@/components/Home/FeedAvatar";
import ArticleSourceLink from "@/components/Reader/ArticleSourceLink";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Tooltip } from "@/components/untitled-ui/base/tooltip/tooltip";
import { resolveFeedIcon } from "@/lib/favicon";
import type { RiverItem } from "@/lib/river/utils";

export interface ReaderHeaderProps {
  item: RiverItem;
  onNavigateHome: () => void;
  onToggleRead: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

export default function ReaderHeader({ item, onNavigateHome, onToggleRead, onPrevious, onNext, hasPrevious, hasNext }: ReaderHeaderProps) {
  return (
    <header className="flex flex-none items-center gap-3 border-b border-secondary px-6.5 py-3.5">
      <Button color="secondary" size="sm" iconLeading={ArrowLeft} className="flex-none rounded-full" onPress={onNavigateHome}>
        Home
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <FeedAvatar title={item.feedTitle} faviconUrl={resolveFeedIcon(item.feedIcon, item.feedLink)} size="sm" />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-primary">{item.feedTitle}</span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-tertiary">{item.categoryName}</span>
      </div>

      <div className="ml-auto flex flex-none items-center gap-1">
        {item.link && (
          <>
            <ArticleSourceLink item={item} />
            <span className="mx-1.5 h-5.5 flex-none border-l border-secondary" />
          </>
        )}

        <Tooltip title="Mark unread">
          <Button aria-label="Mark unread" color="tertiary" size="sm" className="rounded-full" iconLeading={Circle} onPress={onToggleRead} />
        </Tooltip>

        <span className="mx-1.5 h-5.5 flex-none border-l border-secondary" />

        <Button aria-label="Previous article" color="tertiary" size="sm" className="rounded-full" iconLeading={ChevronUp} isDisabled={!hasPrevious} onPress={onPrevious} />
        <Button aria-label="Next article" color="tertiary" size="sm" className="rounded-full" iconLeading={ChevronDown} isDisabled={!hasNext} onPress={onNext} />
      </div>
    </header>
  );
}
