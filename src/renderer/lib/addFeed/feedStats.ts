interface StatItem {
  pubDate: string;
  description: string;
}

const FULL_TEXT_THRESHOLD_CHARS = 400;

export function computePublishRate(items: StatItem[]): string {
  if (items.length === 0) {
    return 'New';
  }

  const timestamps = items.map((item) => new Date(item.pubDate).getTime()).filter((timestamp) => !Number.isNaN(timestamp));
  if (timestamps.length < 2) {
    return `${items.length}`;
  }

  const spanDays = Math.max(1, (Math.max(...timestamps) - Math.min(...timestamps)) / (24 * 60 * 60 * 1000));
  const perDay = items.length / spanDays;
  if (perDay >= 1) {
    return `~${Math.round(perDay)}/day`;
  }

  const perWeek = perDay * 7;
  if (perWeek >= 1) {
    return `~${Math.round(perWeek)}/week`;
  }

  const perMonth = perDay * 30;
  return `~${Math.max(1, Math.round(perMonth))}/month`;
}

export function computeFeedContentType(items: StatItem[]): 'Full text' | 'Excerpt' {
  if (items.length === 0) {
    return 'Excerpt';
  }
  const averageLength = items.reduce((sum, item) => sum + item.description.length, 0) / items.length;
  return averageLength >= FULL_TEXT_THRESHOLD_CHARS ? 'Full text' : 'Excerpt';
}
