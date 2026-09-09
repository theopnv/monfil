import FeedAvatar from "@/components/Home/FeedAvatar";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import { getFaviconUrl } from "@/lib/favicon";
import { computeFeedContentType, computePublishRate } from "@/lib/addFeed/feedStats";
import CategoryPicker from "./CategoryPicker";
import FeedMatchCard from "./FeedMatchCard";
import type { ParsedSource } from "../../../preload/channels";
import type { FeedCategory } from "../../../preload/channels";

export interface Step2ConfigureProps {
  feed: ParsedSource | null;
  categories: FeedCategory[];
  selectedCategoryName: string | null;
  onSelectCategory: (name: string) => void;
  newCategoryName: string;
  onNewCategoryNameChange: (name: string) => void;
  onAddNewCategory: () => void;
  showInHome: boolean;
  onShowInHomeChange: (value: boolean) => void;
}

export default function Step2Configure({
  feed,
  categories,
  selectedCategoryName,
  onSelectCategory,
  newCategoryName,
  onNewCategoryNameChange,
  onAddNewCategory,
  showInHome,
  onShowInHomeChange,
}: Step2ConfigureProps) {
  return (
    <div className="flex flex-col gap-4.5 px-7.5 py-5.5">
      {feed ? (
        <div className="rounded-xl border border-secondary bg-secondary px-5 py-4.5">
          <div className="flex items-start gap-3.5">
            <FeedAvatar title={feed.title || feed.link} faviconUrl={getFaviconUrl(feed.link)} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="text-lg leading-tight font-bold text-primary">{feed.title || feed.link}</div>
              <div className="mb-1.75 text-xs text-tertiary">{feed.link}</div>
              {feed.description && <p className="text-sm leading-relaxed text-tertiary text-pretty">{feed.description}</p>}
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-4 border-t border-secondary pt-3.5">
            <div className="leading-tight">
              <div className="text-sm font-bold tabular-nums text-primary">{computePublishRate(feed.items)}</div>
              <div className="text-[11.5px] text-quaternary">Publishes</div>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-primary">{computeFeedContentType(feed.items)}</div>
              <div className="text-[11.5px] text-quaternary">Feed contains</div>
            </div>
          </div>
        </div>
      ) : (
        <FeedMatchCard title="No feed found" detail="Go back to step 1 and try a different link." status="not-found" />
      )}

      <CategoryPicker
        categories={categories}
        selectedName={selectedCategoryName}
        onSelect={onSelectCategory}
        newName={newCategoryName}
        onNewNameChange={onNewCategoryNameChange}
        onAddNew={onAddNewCategory}
      />

      <Toggle isSelected={showInHome} onChange={onShowInHomeChange} label="Show in Home" hint="Uncheck for high-volume sources you'd rather visit on purpose." />
    </div>
  );
}
