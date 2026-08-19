import type { Feed } from '../../preload/channels';

export type Density = "Cards" | "Magazine" | "Compact";

export const DENSITIES: readonly Density[] = ["Cards", "Magazine", "Compact"];

export interface RiverItem {
  id: number;
  title: string;
  link: string | undefined;
  pubDate: string;
  description: string;
  feedTitle: string;
  feedLink: string;
  categoryName: string;
  image: string | undefined;
}

export interface RiverCardProps {
  item: RiverItem;
  read: boolean;
  onOpen: (id: number) => void;
}

function parseTimestamp(pubDate: string): number {
  const timestamp = new Date(pubDate).getTime();
  return Number.isNaN(timestamp) ? 0 : timestamp;
}

// RSS <description> fields routinely carry embedded HTML (paragraphs, "read
// more" links, entity-encoded punctuation). Cards render the excerpt as plain
// text, so strip markup here rather than leaking raw tags into the UI.
function stripHtml(html: string): string {
  const container = document.createElement('div');
  container.innerHTML = html;
  // textContent includes <style>/<script> text nodes even though they never render;
  // Blogger/Blogspot feeds in particular embed a <style> block ahead of the article body.
  container.querySelectorAll('style, script').forEach((el) => el.remove());
  return (container.textContent ?? '').replace(/\s+/g, ' ').trim();
}

export function toRiverItems(feeds: Feed[]): RiverItem[] {
  const items = feeds
    .flatMap((feed) =>
      feed.items.map((item) => ({
        id: item.id,
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        description: stripHtml(item.description),
        feedTitle: feed.title,
        feedLink: feed.link,
        categoryName: feed.category.name,
        image: item.image,
      }))
    );

  return items.sort((a, b) => parseTimestamp(b.pubDate) - parseTimestamp(a.pubDate));
}

export function formatRelativeTime(pubDate: string): string {
  const timestamp = new Date(pubDate).getTime();
  if (Number.isNaN(timestamp)) {
    return pubDate;
  }

  const diffMs = Math.max(0, Date.now() - timestamp);
  const diffMinutes = Math.floor(diffMs / (60 * 1000));
  const diffHours = Math.floor(diffMs / (60 * 60 * 1000));
  const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));

  if (diffDays >= 7) {
    return new Date(timestamp).toLocaleDateString();
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
