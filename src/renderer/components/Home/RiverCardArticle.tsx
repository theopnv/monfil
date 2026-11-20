// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatLocale } from "@/lib/i18n";
import FeedAvatar from "@/components/common/FeedAvatar";
import JobFacts from "@/components/Home/JobFacts";
import RiverCardImage from "@/components/Home/RiverCardImage";
import { CategoryChip, RiverCardShell, UnreadDot } from "@/components/Home/RiverCardShell";
import { describeRiverCard, estimateReadTime, formatRelativeTime, type RiverCardProps } from "@/lib/river/utils";

function RiverCardArticle({ item, read, onOpen }: RiverCardProps) {
  const { t } = useTranslation('river');
  const locale = useFormatLocale();
  const time = formatRelativeTime(item.publishedAt, locale);
  return (
    <RiverCardShell
      as="article"
      item={item}
      read={read}
      onOpen={onOpen}
      label={describeRiverCard(item, read, t, time)}
      className="flex cursor-pointer gap-4.5 rounded-xl border border-secondary bg-primary p-5 transition hover:border-brand hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        {/* Keeps the time clear of the save button RiverList overlays on the card's top-right corner. */}
        <div className="mb-2.25 flex items-center gap-2 pe-7">
          <UnreadDot read={read} />
          <FeedAvatar title={item.feedTitle} faviconUrl={item.feedIcon} size="md" />
          <span dir="auto" className="min-w-0 truncate text-sm font-bold text-primary">{item.feedTitle}</span>
          <span className="flex-none text-sm text-tertiary">{time}</span>
        </div>

        <h4 dir="auto" className="mb-1.75 text-lg leading-tight font-bold text-pretty text-primary">{item.title}</h4>
        {item.job && <JobFacts job={item.job} className="mb-1.75" />}
        {item.excerpt && <p dir="auto" className="text-sm leading-relaxed text-pretty text-tertiary">{item.excerpt}</p>}

        <div className="mt-3.25 flex items-center gap-2">
          {item.excerpt && <span className="text-xs text-tertiary">{estimateReadTime(item.excerpt, t)}</span>}
          <span className="size-0.75 flex-none rounded-full bg-quaternary" />
          {item.categoryName && <CategoryChip name={item.categoryName} className="px-2.5 py-0.75" />}
        </div>
      </div>

      {/* The right margin keeps the image clear of the save button RiverList overlays on the card's top-right corner. */}
      <RiverCardImage src={item.image} className="me-7 h-28 w-37.5 flex-none rounded-lg" />
    </RiverCardShell>
  );
}

export default memo(RiverCardArticle);
