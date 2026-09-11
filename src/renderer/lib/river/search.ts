import type { RiverItem } from "./utils";

export type SearchableRiverItem = Pick<RiverItem, "id" | "title" | "description" | "feedTitle">;

/**
 * Filters river items against a search query. Case-insensitive; the query is
 * split on whitespace and every word must appear in the item title, the
 * description excerpt, or the feed title. An empty or whitespace-only query
 * returns the input array unchanged.
 */
export function filterBySearch<T extends SearchableRiverItem>(items: T[], query: string): T[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) {
    return items;
  }

  return items.filter((item) =>
    words.every((word) =>
      item.title.toLowerCase().includes(word)
      || item.description.toLowerCase().includes(word)
      || item.feedTitle.toLowerCase().includes(word)
    )
  );
}
