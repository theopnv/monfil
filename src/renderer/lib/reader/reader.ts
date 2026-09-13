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

const HTML_ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const URL_REGEX = /https?:\/\/[^\s<]+[^\s<.,!?:;'")\]]/g;

/**
 * Turns a plain-text description (no HTML of its own, e.g. a video or a short-form post) into
 * safe markup: escapes it, then linkifies bare URLs and turns newlines into breaks, ready for
 * `ArticleBody`'s sanitizer.
 */
export function renderPlainTextDescription(description: string): string {
  const escaped = description.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char] ?? char);
  const linked = escaped.replace(URL_REGEX, (url) => `<a href="${url}">${url}</a>`);
  return linked.replace(/\n/g, '<br>');
}
