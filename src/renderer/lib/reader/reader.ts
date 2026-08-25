import type { Feed } from '../../../preload/channels';
import type { RiverItem } from '../river/utils';

export interface ReaderNavigation {
  previous: RiverItem | undefined;
  next: RiverItem | undefined;
  nextUnread: RiverItem | undefined;
}

export function getReaderNavigation(items: RiverItem[], currentId: number, isRead: (id: number) => boolean): ReaderNavigation {
  const index = items.findIndex((item) => item.id === currentId);
  if (index === -1) {
    return { previous: undefined, next: undefined, nextUnread: undefined };
  }

  const previous = items[index - 1];
  const next = items[index + 1];
  const nextUnread = items.slice(index + 1).find((item) => !isRead(item.id)) ?? next;

  return { previous, next, nextUnread };
}

export function deriveStandfirst(strippedDescription: string, maxLength = 200): string | undefined {
  const trimmed = strippedDescription.trim();
  if (!trimmed) {
    return undefined;
  }
  if (trimmed.length <= maxLength) {
    return trimmed;
  }

  const truncated = trimmed.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(' ');
  const boundary = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;
  return `${boundary.trimEnd()}…`;
}

export function findRawDescription(feeds: Feed[], itemId: number): string | undefined {
  return feeds.flatMap((feed) => feed.items).find((item) => item.id === itemId)?.description;
}
