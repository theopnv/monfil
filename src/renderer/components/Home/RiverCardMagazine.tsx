// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatLocale } from "@/lib/i18n";
import FeedAvatar from "@/components/common/FeedAvatar";
import JobFacts from "@/components/Home/JobFacts";
import RiverCardImage from "@/components/Home/RiverCardImage";
import { Badge } from "@/components/untitled-ui/base/badges/badges";
import { CategoryChip, RiverCardShell, UnreadDot } from "@/components/Home/RiverCardShell";
import { describeRiverCard, formatRelativeTime, sourceTypeLabel, type RiverCardProps } from "@/lib/river/utils";

function RiverCardMagazine({ item, read, onOpen }: RiverCardProps) {
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
      className="flex cursor-pointer flex-col overflow-hidden rounded-xl border border-secondary bg-primary transition hover:border-brand hover:shadow-md"
    >
      <RiverCardImage src={item.image} className="h-33 w-full" />

      <div className="flex flex-1 flex-col p-4.25">
        {/* Keeps the time clear of the save button RiverList overlays, which an absent or failed image leaves over this row. */}
        <div className="mb-2 flex items-center gap-1.75 pe-7">
          <UnreadDot read={read} />
          <FeedAvatar title={item.feedTitle} faviconUrl={item.feedIcon} size="sm" />
          <span dir="auto" className="overflow-hidden text-ellipsis whitespace-nowrap text-xs font-bold text-primary">{item.feedTitle}</span>
          <span className="ms-auto flex-none text-xs text-tertiary">{time}</span>
        </div>

        <h4 dir="auto" className="mb-1.75 text-base leading-snug font-bold text-pretty text-primary">{item.title}</h4>
        {item.job && <JobFacts job={item.job} className="mb-1.75" />}
        {item.excerpt && <p dir="auto" className="text-sm leading-snug text-pretty text-tertiary">{item.excerpt}</p>}

        <div className="mt-auto flex items-center gap-2 pt-3">
          {item.categoryName && <CategoryChip name={item.categoryName} className="px-2.25 py-0.5" />}
          <Badge color="brand" size="sm">
            {sourceTypeLabel(item.type, t)}
          </Badge>
        </div>
      </div>
    </RiverCardShell>
  );
}

export default memo(RiverCardMagazine);
