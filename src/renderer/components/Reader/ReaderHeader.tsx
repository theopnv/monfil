// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { ArrowLeft, ChevronDown, ChevronUp, Circle } from "@untitledui/icons";
import SaveButton from "@/components/common/SaveButton";
import FeedAvatar from "@/components/common/FeedAvatar";
import ArticleSourceLink from "@/components/Reader/ArticleSourceLink";
import { Button } from "@/components/untitled-ui/base/buttons/button";
import { mirrored } from "@/components/common/mirrored-icon";
import { Tooltip } from "@/components/untitled-ui/base/tooltip/tooltip";
import type { RiverRow } from "../../../shared/contracts";

export interface ReaderHeaderProps {
  item: RiverRow;
  onNavigateHome: () => void;
  onToggleRead: () => void;
  onPrevious: () => void;
  onNext: () => void;
  hasPrevious: boolean;
  hasNext: boolean;
  savedView?: boolean;
}

const BackArrow = mirrored(ArrowLeft);

export default function ReaderHeader({ item, onNavigateHome, onToggleRead, onPrevious, onNext, hasPrevious, hasNext, savedView }: ReaderHeaderProps) {
  const { t } = useTranslation('reader');
  return (
    <header className="flex flex-none items-center gap-3 border-b border-secondary px-6.5 py-3.5">
      <Button color="secondary" size="sm" iconLeading={BackArrow} className="flex-none rounded-full" onPress={onNavigateHome}>
        {savedView ? t('header.saved') : t('header.home')}
      </Button>

      <div className="flex min-w-0 items-center gap-2">
        <FeedAvatar title={item.feedTitle} faviconUrl={item.feedIcon} size="sm" />
        <span dir="auto" className="overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-primary">{item.feedTitle}</span>
        {item.categoryName && <span className="overflow-hidden text-ellipsis whitespace-nowrap text-sm text-tertiary">{item.categoryName}</span>}
      </div>

      <div className="ms-auto flex flex-none items-center gap-1">
        {item.link && (
          <>
            <ArticleSourceLink item={item} />
            <span className="mx-1.5 h-5.5 flex-none border-s border-secondary" />
          </>
        )}

        <Tooltip title={t('header.markUnread')}>
          <Button aria-label={t('header.markUnread')} color="tertiary" size="sm" className="rounded-full" iconLeading={Circle} onPress={onToggleRead} />
        </Tooltip>
        <SaveButton item={item} {...(savedView ? { onRemoved: onNavigateHome } : {})} />

        <span className="mx-1.5 h-5.5 flex-none border-s border-secondary" />

        <Button aria-label={t('header.previous')} color="tertiary" size="sm" className="rounded-full" iconLeading={ChevronUp} isDisabled={!hasPrevious} onPress={onPrevious} />
        <Button aria-label={t('header.next')} color="tertiary" size="sm" className="rounded-full" iconLeading={ChevronDown} isDisabled={!hasNext} onPress={onNext} />
      </div>
    </header>
  );
}
