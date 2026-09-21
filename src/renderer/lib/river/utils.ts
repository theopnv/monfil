import type { RiverRow, SourceType } from '../../../shared/contracts';

export type Density = "Cards" | "Magazine" | "Compact";

export const DENSITIES: readonly Density[] = ["Cards", "Magazine", "Compact"];

/** The uppercase badge word for a source type, e.g. "RSS" / "YOUTUBE". */
export const SOURCE_TYPE_LABEL: Record<SourceType, string> = {
  rss: 'RSS',
  youtube: 'YOUTUBE',
};

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
export function describeRiverCard(item: RiverRow, read: boolean): string {
  return `${item.title}, ${read ? "read" : "unread"}, from ${item.feedTitle}, ${formatRelativeTime(item.publishedAt)}.`;
}

const WORDS_PER_MINUTE = 200;

export function estimateReadTime(input: string | number): string {
  const wordCount = typeof input === 'number' ? input : input.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.round(wordCount / WORDS_PER_MINUTE));
  return `${minutes} min read`;
}

export function openLink(link: string | undefined): void {
  if (!link) {
    return;
  }
  window.electron.ipcRenderer.sendMessage('link:open', link);
}
