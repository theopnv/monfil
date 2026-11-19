// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { useTranslation } from 'react-i18next';
import { useFormatLocale } from "@/lib/i18n";
import { Badge } from "@/components/untitled-ui/base/badges/badges";
import { estimateReadTime, formatRelativeTime, sourceTypeLabel } from "@/lib/river/utils";
import type { RiverRow } from "../../../shared/contracts";

export interface ArticleMetaProps {
  item: RiverRow;
  wordCount: number | undefined;
}

export default function ArticleMeta({ item, wordCount }: ArticleMetaProps) {
  const { t } = useTranslation('river');
  const locale = useFormatLocale();
  const readTime = wordCount === undefined ? undefined : estimateReadTime(wordCount, t);

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2.25">
      <Badge color="brand" size="sm">
        {sourceTypeLabel(item.type, t)}
      </Badge>
      <span className="text-sm text-tertiary">
        <bdi>{item.feedTitle}</bdi> · {formatRelativeTime(item.publishedAt, locale)}
        {readTime && <> · {readTime}</>}
      </span>
    </div>
  );
}
