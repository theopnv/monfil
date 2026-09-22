import { infiniteQueryOptions, queryOptions, type InfiniteData } from '@tanstack/react-query';
import { ipc } from '@/lib/ipc-client';
import type { FeedCategory, FeedSummary, RiverCursor, RiverPage, RiverQuery, RiverRow, WorkspaceSummary } from '../../shared/contracts';

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
  feeds: (workspaceId: number) => ['feeds', workspaceId] as const,
  categories: (workspaceId: number) => ['categories', workspaceId] as const,
  workspaces: ['workspaces'] as const,
  river: (scope: RiverScope) => ['river', normalizeScope(scope)] as const,
};

export function feedsQuery(workspaceId: number) {
  return queryOptions({
    queryKey: queryKeys.feeds(workspaceId),
    queryFn: (): Promise<FeedSummary[]> => ipc.invoke('feeds:list', { workspaceId }),
  });
}

/** Every category in `workspaceId`, including one with no feeds in it yet — unlike `FeedSummary.category`, which only surfaces a category through a feed that belongs to it. */
export function categoriesQuery(workspaceId: number) {
  return queryOptions({
    queryKey: queryKeys.categories(workspaceId),
    queryFn: (): Promise<FeedCategory[]> => ipc.invoke('feeds:list-categories', { workspaceId }),
  });
}

/** Every workspace, in rail order. */
export function workspacesQuery() {
  return queryOptions({
    queryKey: queryKeys.workspaces,
    queryFn: (): Promise<WorkspaceSummary[]> => ipc.invoke('workspaces:list', undefined),
  });
}

export function riverQuery(scope: RiverScope) {
  const normalized = normalizeScope(scope);
  return infiniteQueryOptions({
    queryKey: queryKeys.river(scope),
    queryFn: ({ pageParam }): Promise<RiverPage> => ipc.invoke('items:query', {
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
