import { useState } from "react";
import { ArrowLeft, Bookmark, ChevronDown, ChevronUp, Circle, LinkExternal01, PenTool01 } from "@untitledui/icons";
import FeedAvatar from "@/components/Home/FeedAvatar";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { Tooltip } from "@/components/untitled-ui/base/tooltip/tooltip";
import { getFaviconUrl } from "@/lib/favicon";
import type { RiverItem } from "@/lib/river/utils";

export interface ReaderHeaderProps {
  item: RiverItem;
  onNavigateHome: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
}

const PLACEHOLDER_ACTIONS = [
  { key: "save", label: "Save", icon: Bookmark },
  { key: "unread", label: "Mark unread", icon: Circle },
  { key: "highlight", label: "Highlight", icon: PenTool01 },
  { key: "original", label: "Open original", icon: LinkExternal01 },
] as const;

export default function ReaderHeader({ item, onNavigateHome, onPrevious, onNext, hasPrevious, hasNext }: ReaderHeaderProps) {
  const [active, setActive] = useState<Record<string, boolean>>({});

  return (
    <header className="flex flex-none items-center gap-3 border-b border-secondary px-6.5 py-3.5">
      <Button color="secondary" size="sm" iconLeading={ArrowLeft} className="flex-none rounded-full" onPress={onNavigateHome}>
        Home
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <FeedAvatar title={item.feedTitle} faviconUrl={getFaviconUrl(item.feedLink)} size="sm" />
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-primary">{item.feedTitle}</span>
        <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-quaternary">{item.categoryName}</span>
      </div>

      <div className="ml-auto flex flex-none items-center gap-1">
        {PLACEHOLDER_ACTIONS.map(({ key, label, icon: Icon }) => (
          <Tooltip key={key} title={label}>
            <Button
              aria-label={label}
              aria-pressed={active[key] ?? false}
              color={active[key] ? "secondary" : "tertiary"}
              size="sm"
              className="rounded-full"
              iconLeading={Icon}
              onPress={() => setActive((prev) => ({ ...prev, [key]: !prev[key] }))}
            />
          </Tooltip>
        ))}

        <span className="mx-1.5 h-5.5 flex-none border-l border-secondary" />

        <Button aria-label="Previous article" color="tertiary" size="sm" className="rounded-full" iconLeading={ChevronUp} isDisabled={!hasPrevious} onPress={onPrevious} />
        <Button aria-label="Next article" color="tertiary" size="sm" className="rounded-full" iconLeading={ChevronDown} isDisabled={!hasNext} onPress={onNext} />
      </div>
    </header>
  );
}
