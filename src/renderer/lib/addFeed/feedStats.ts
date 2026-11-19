// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { TFunction } from 'i18next';

interface StatItem {
  pubDate: string;
  description: string;
}

const FULL_TEXT_THRESHOLD_CHARS = 400;

export function computePublishRate(items: StatItem[], t: TFunction<'addFeed'>): string {
  if (items.length === 0) {
    return t('stats.new');
  }

  const timestamps = items.map((item) => new Date(item.pubDate).getTime()).filter((timestamp) => !Number.isNaN(timestamp));
  if (timestamps.length < 2) {
    return `${items.length}`;
  }

  const spanDays = Math.max(1, (Math.max(...timestamps) - Math.min(...timestamps)) / (24 * 60 * 60 * 1000));
  const perDay = items.length / spanDays;
  if (perDay >= 1) {
    return t('stats.perDay', { count: Math.round(perDay) });
  }

  const perWeek = perDay * 7;
  if (perWeek >= 1) {
    return t('stats.perWeek', { count: Math.round(perWeek) });
  }

  const perMonth = perDay * 30;
  return t('stats.perMonth', { count: Math.max(1, Math.round(perMonth)) });
}

export function computeFeedContentType(items: StatItem[], t: TFunction<'addFeed'>): string {
  // Stryker disable next-line ConditionalExpression,BlockStatement: with no items the average is NaN, which is below the threshold, so 'Excerpt' follows anyway
  if (items.length === 0) {
    return t('stats.excerpt');
  }
  const averageLength = items.reduce((sum, item) => sum + item.description.length, 0) / items.length;
  return averageLength >= FULL_TEXT_THRESHOLD_CHARS ? t('stats.fullText') : t('stats.excerpt');
}
