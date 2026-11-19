// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useFormatLocale } from "@/lib/i18n";
import FeedAvatar from "@/components/common/FeedAvatar";
import { cx } from "@/components/untitled-ui/utils/cx";
import type { JobDetails } from "../../../shared/contracts";
import { describeRiverCard, formatRelativeTime, sourceTypeLabel, type RiverCardProps } from "@/lib/river/utils";

function jobSuffix(job: JobDetails): string {
  const parts = [job.location, job.salaryLabel].filter((part): part is string => part !== undefined);
  return parts.length > 0 ? ` — ${parts.join(" · ")}` : "";
}

export default function RiverCardCompact({ item, read, onOpen }: RiverCardProps) {
  const { t } = useTranslation('river');
  const locale = useFormatLocale();
  return (
    <div
      data-item-id={item.id}
      role="button"
      tabIndex={0}
      aria-label={describeRiverCard(item, read, t, locale)}
      onClick={() => onOpen(item.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onOpen(item.id);
        }
      }}
      className={cx(
        "flex cursor-pointer items-center gap-3 py-2.75 ps-4 pe-12 transition hover:bg-brand-secondary",
        read && "opacity-50",
      )}
    >
      <span aria-hidden className={cx("size-1.75 flex-none rounded-full", read ? "bg-quaternary" : "bg-brand-solid")} />
      <FeedAvatar title={item.feedTitle} faviconUrl={item.feedIcon} size="sm" />
      <span className="w-33 flex-none overflow-hidden text-ellipsis whitespace-nowrap text-sm font-bold text-primary">{item.feedTitle}</span>
      <span dir="auto" className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-sm text-secondary">{item.title}{item.job && <span className="text-tertiary">{jobSuffix(item.job)}</span>}</span>
      {item.categoryName && <span className="flex-none rounded-full bg-sage-200 px-2 py-0.5 text-xs font-semibold text-sage-800">{item.categoryName}</span>}
      <span className="flex-none text-xs font-bold tracking-wide text-tertiary">{sourceTypeLabel(item.type, t)}</span>
      <span className="w-13 flex-none text-end text-xs text-tertiary tabular-nums">{formatRelativeTime(item.publishedAt, locale)}</span>
    </div>
  );
}
