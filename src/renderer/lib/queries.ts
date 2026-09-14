import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query';
import type { FeedSummary, RiverCursor, RiverPage, RiverQuery, RiverRow } from '../../preload/channels';

export const RIVER_PAGE_SIZE = 50;
export const RIVER_MAX_PAGES = 8;

/** A river query without paging: what the window is scoped to, not where it currently is. */
export type RiverScope = Omit<RiverQuery, 'cursor' | 'limit'>;

// Sorted so `{ feedIds: [1, 2] }` and `{ feedIds: [2, 1] }` share one cache entry.
function normalizeScope(scope: RiverScope): RiverScope {
  return {
    ...scope,
    ...(scope.feedIds ? { feedIds: [...scope.feedIds].sort((a, b) => a - b) } : {}),
  };
}

export const queryKeys = {
  feeds: ['feeds'] as const,
  river: (scope: RiverScope) => ['river', normalizeScope(scope)] as const,
};

export function feedsQuery() {
  return queryOptions({
    queryKey: queryKeys.feeds,
    queryFn: (): Promise<FeedSummary[]> => window.electron.ipcRenderer.invoke('feeds:list', undefined),
  });
}

export function riverQuery(scope: RiverScope) {
  const normalized = normalizeScope(scope);
  return infiniteQueryOptions({
    queryKey: queryKeys.river(scope),
    queryFn: ({ pageParam }): Promise<RiverPage> => window.electron.ipcRenderer.invoke('items:query', {
      ...normalized,
      limit: RIVER_PAGE_SIZE,
      ...(pageParam ? { cursor: pageParam } : {}),
    }),
    initialPageParam: undefined as RiverCursor | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
    maxPages: RIVER_MAX_PAGES,
  });
}

/**
 * Appends `rows` (deduped against ids already present) to the end of the last loaded page.
 * Used for a row that resolves past the loaded window (a deep link, or `nextUnread` past the
 * cursor), so navigation finds it locally on the next render without a later `fetchNextPage`
 * walking that stretch and duplicating it.
 */
export function mergeRiverRows(data: InfiniteData<RiverPage>, rows: RiverRow[]): InfiniteData<RiverPage> {
  const existingIds = new Set(data.pages.flatMap((page) => page.rows.map((row) => row.id)));
  const newRows = rows.filter((row) => !existingIds.has(row.id));
  const lastPage = data.pages[data.pages.length - 1];
  if (newRows.length === 0 || !lastPage) {
    return data;
  }

  const pages = [...data.pages];
  pages[pages.length - 1] = { ...lastPage, rows: [...lastPage.rows, ...newRows] };
  return { ...data, pages };
}

/** Applies `patch` to every row in `data` whose id is in `targetIds`, leaving every other page and row untouched. */
export function patchRiverRows(
  data: InfiniteData<RiverPage>,
  targetIds: ReadonlySet<number>,
  patch: (row: RiverRow) => RiverRow,
): InfiniteData<RiverPage> {
  return {
    ...data,
    pages: data.pages.map((page) => ({
      ...page,
      rows: page.rows.map((row) => (targetIds.has(row.id) ? patch(row) : row)),
    })),
  };
}
