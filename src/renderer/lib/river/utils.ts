// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { TFunction } from 'i18next';
import type { RiverRow, SourceType } from '../../../shared/contracts';
import { ipc } from '@/lib/ipc-client';

// Brand and protocol names stay as they are in every language.
const BRAND_SOURCE_LABEL: Record<Exclude<SourceType, 'conference' | 'ats'>, string> = {
  rss: 'RSS',
  youtube: 'YOUTUBE',
  github: 'GITHUB',
  gitlab: 'GITLAB',
  hackernews: 'HN',
  arxiv: 'ARXIV',
  bluesky: 'BLUESKY',
  mastodon: 'MASTODON',
};

/** The uppercase badge word for a source type, e.g. "RSS" / "YOUTUBE". Only conference and job get translated. */
export function sourceTypeLabel(type: SourceType, t: TFunction<'river'>): string {
  if (type === 'conference') {
    return t('source.conference');
  }
  return type === 'ats' ? t('source.job') : BRAND_SOURCE_LABEL[type];
}

export interface RiverCardProps {
  item: RiverRow;
  read: boolean;
  onOpen: (id: number) => void;
}

export function formatRelativeTime(publishedAt: number): string {
  const diffMs = Math.max(0, Date.now() - publishedAt);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays >= 7) {
    return new Date(publishedAt).toLocaleDateString();
  }
  if (diffDays >= 1) {
    return `${diffDays}d`;
  }
  if (diffHours >= 1) {
    return `${diffHours}h`;
  }
  if (diffMinutes >= 1) {
    return `${diffMinutes}m`;
  }
  return 'now';
}

/** Screen-reader label for a river card: state isn't conveyed by opacity alone. */
export function describeRiverCard(item: RiverRow, read: boolean, t: TFunction<'river'>): string {
  return t('card.label', { context: read ? 'read' : 'unread', title: item.title, feed: item.feedTitle, time: formatRelativeTime(item.publishedAt) });
}

const WORDS_PER_MINUTE = 200;

export function estimateReadTime(input: string | number): string {
  // Stryker disable next-line MethodExpression,Regex: blank pieces from edge or repeated whitespace are removed by filter(Boolean), and an empty text rounds up to 1 min anyway
  const wordCount = typeof input === 'number' ? input : input.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

export function openLink(link: string | undefined): void {
  if (!link) {
    return;
  }
  ipc.send('link:open', link);
}
