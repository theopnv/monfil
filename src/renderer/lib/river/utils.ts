// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { TFunction } from 'i18next';
import type { RiverRow, SourceType } from '../../../shared/contracts';
import { ipc } from '@/lib/ipc-client';
import { countWords } from '../../../shared/word-count';

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

interface TimeFormatters {
  date: Intl.DateTimeFormat;
  now: string;
  unit: Record<'day' | 'hour' | 'minute', Intl.NumberFormat>;
}

const timeFormatters = new Map<string, TimeFormatters>();

function formattersFor(locale: string): TimeFormatters {
  let formatters = timeFormatters.get(locale);
  // Stryker disable next-line ConditionalExpression: the cache only saves building the formatters again; the output is the same without it
  if (!formatters) {
    const unit = (name: 'day' | 'hour' | 'minute') => new Intl.NumberFormat(locale, { style: 'unit', unit: name, unitDisplay: 'narrow' });
    formatters = {
      // Stryker disable next-line ObjectLiteral: year, month, and day all numeric is what Intl uses when no option is given
      date: new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'numeric', day: 'numeric' }),
      now: new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(0, 'second'),
      unit: { day: unit('day'), hour: unit('hour'), minute: unit('minute') },
    };
    // Stryker disable next-line CallExpression: the cache only saves building the formatters again
    timeFormatters.set(locale, formatters);
  }
  return formatters;
}

/** How long ago an item came out, in the shortest form of the locale: "5m", "3h", "2d", then a date from a week on. */
export function formatRelativeTime(publishedAt: number, locale: string): string {
  const formatters = formattersFor(locale);
  const diffMs = Math.max(0, Date.now() - publishedAt);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays >= 7) {
    return formatters.date.format(publishedAt);
  }
  if (diffDays >= 1) {
    return formatters.unit.day.format(diffDays);
  }
  if (diffHours >= 1) {
    return formatters.unit.hour.format(diffHours);
  }
  if (diffMinutes >= 1) {
    return formatters.unit.minute.format(diffMinutes);
  }
  return formatters.now;
}

/** Screen-reader label for a river card: state isn't conveyed by opacity alone. */
export function describeRiverCard(item: RiverRow, read: boolean, t: TFunction<'river'>, time: string): string {
  return t('card.label', { context: read ? 'read' : 'unread', title: item.title, feed: item.feedTitle, time });
}

const WORDS_PER_MINUTE = 200;

export function estimateReadTime(input: string | number, t: TFunction<'river'>): string {
  const wordCount = typeof input === 'number' ? input : countWords(input);
  const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  return t('readTime', { count: minutes });
}

export function openLink(link: string | undefined): void {
  if (!link) {
    return;
  }
  ipc.send('link:open', link);
}
