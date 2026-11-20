// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { memo } from 'react';
import { useTranslation } from 'react-i18next';
import { useFormatLocale } from "@/lib/i18n";
import FeedAvatar from "@/components/common/FeedAvatar";
import { CategoryChip, RiverCardShell, UnreadDot } from "@/components/Home/RiverCardShell";
import type { JobDetails } from "../../../shared/contracts";
import { describeRiverCard, formatRelativeTime, sourceTypeLabel, type RiverCardProps } from "@/lib/river/utils";

function jobSuffix(job: JobDetails): string {
  const parts = [job.location, job.salaryLabel].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? ` — ${parts.join(" · ")}` : "";
}

function RiverCardCompact({ item, read, onOpen }: RiverCardProps) {
  const { t } = useTranslation('river');
  const locale = useFormatLocale();
  const time = formatRelativeTime(item.publishedAt, locale);
  return (
    <RiverCardShell
      as="div"
      item={item}
      read={read}
      onOpen={onOpen}
      label={describeRiverCard(item, read, t, time)}
      className="flex cursor-pointer items-center gap-3 py-2.75 ps-4 pe-12 transition hover:bg-brand-secondary"
    >
      <UnreadDot read={read} />
      <FeedAvatar title={item.feedTitle} faviconUrl={item.feedIcon} size="sm" />
      <span className="w-33 flex-none overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-primary">{item.feedTitle}</span>
      <span dir="auto" className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-secondary">{item.title}{item.job && <span className="text-tertiary">{jobSuffix(item.job)}</span>}</span>
      {item.categoryName && <CategoryChip name={item.categoryName} className="flex-none px-2 py-0.5" />}
      <span className="flex-none text-xs font-bold tracking-wide text-tertiary">{sourceTypeLabel(item.type, t)}</span>
      <span className="w-13 flex-none text-end text-xs text-tertiary tabular-nums">{time}</span>
    </RiverCardShell>
  );
}

export default memo(RiverCardCompact);
