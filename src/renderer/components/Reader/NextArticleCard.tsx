// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useFormatLocale } from "@/lib/i18n";
import { ArrowRight } from "@untitledui/icons";
import { estimateReadTime, formatRelativeTime } from "@/lib/river/utils";
import type { RiverRow } from "../../../shared/contracts";

export interface NextArticleCardProps {
  item: RiverRow;
  kind: "unread" | "article";
  onClick: () => void;
}

export default function NextArticleCard({ item, kind, onClick }: NextArticleCardProps) {
  const { t } = useTranslation('reader');
  const { t: tRiver } = useTranslation('river');
  const locale = useFormatLocale();
  return (
    <button
      type="button"
      onClick={onClick}
      className="mb-8.5 flex w-full items-center gap-4.5 rounded-xl border border-secondary p-5.5 text-start transition hover:border-brand hover:shadow-md"
    >
      <div className="min-w-0 flex-1">
        <div className="mb-1.75 text-xs font-bold tracking-wide text-tertiary uppercase">{t(`next.${kind}`)}</div>
        <div className="mb-1.25 text-lg leading-tight font-bold text-pretty text-primary">{item.title}</div>
        <div className="text-sm text-tertiary">
          {item.feedTitle} · {estimateReadTime(item.excerpt, tRiver)} · {formatRelativeTime(item.publishedAt, locale)}
        </div>
      </div>
      <span className="flex size-10 flex-none items-center justify-center rounded-full bg-brand-secondary text-brand-tertiary">
        <ArrowRight className="size-4.5" />
      </span>
    </button>
  );
}
