// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import FeedAvatar from "@/components/common/FeedAvatar";
import { Toggle } from "@/components/untitled-ui/base/toggle/toggle";
import { computeFeedContentType, computePublishRate } from "@/lib/addFeed/feedStats";
import CategoryPicker from "./CategoryPicker";
import FeedMatchCard from "./FeedMatchCard";
import type { ParsedSource } from "../../../shared/contracts";
import type { FeedCategory } from "../../../shared/contracts";

export interface Step2ConfigureProps {
  feed: ParsedSource | null;
  categories: FeedCategory[];
  selectedCategoryName: string | null;
  onSelectCategory: (name: string) => void;
  newCategoryName: string;
  onNewCategoryNameChange: (name: string) => void;
  onAddNewCategory: () => void;
  showInWorkspace: boolean;
  onShowInWorkspaceChange: (value: boolean) => void;
}

export default function Step2Configure({
  feed,
  categories,
  selectedCategoryName,
  onSelectCategory,
  newCategoryName,
  onNewCategoryNameChange,
  onAddNewCategory,
  showInWorkspace,
  onShowInWorkspaceChange,
}: Step2ConfigureProps) {
  const { t } = useTranslation('addFeed');
  return (
    <div className="flex flex-col gap-4.5 px-7.5 py-5.5">
      {feed ? (
        <div className="rounded-xl border border-secondary bg-secondary px-5 py-4.5">
          <div className="flex items-start gap-3.5">
            <FeedAvatar title={feed.title || feed.link} faviconUrl={feed.icon} size="lg" />
            <div className="min-w-0 flex-1">
              <div className="text-lg leading-tight font-bold text-primary">{feed.title || feed.link}</div>
              <div className="mb-1.75 text-xs text-tertiary">{feed.link}</div>
              {feed.description && <p dir="auto" className="text-sm leading-relaxed text-tertiary text-pretty">{feed.description}</p>}
            </div>
          </div>

          <div className="mt-3.5 flex flex-wrap gap-4 border-t border-secondary pt-3.5">
            <div className="leading-tight">
              <div className="text-sm font-bold tabular-nums text-primary">{computePublishRate(feed.items, t)}</div>
              <div className="text-[11.5px] text-tertiary">{t('configure.publishes')}</div>
            </div>
            <div className="leading-tight">
              <div className="text-sm font-bold text-primary">{computeFeedContentType(feed.items, t)}</div>
              <div className="text-[11.5px] text-tertiary">{t('configure.contains')}</div>
            </div>
          </div>
        </div>
      ) : (
        <FeedMatchCard title={t('configure.notFound')} detail={t('configure.notFoundDetail')} status="not-found" />
      )}

      <CategoryPicker
        categories={categories}
        selectedName={selectedCategoryName}
        onSelect={onSelectCategory}
        newName={newCategoryName}
        onNewNameChange={onNewCategoryNameChange}
        onAddNew={onAddNewCategory}
      />

      <Toggle isSelected={showInWorkspace} onChange={onShowInWorkspaceChange} label={t('configure.show')} hint={t('configure.showHint')} />
    </div>
  );
}
