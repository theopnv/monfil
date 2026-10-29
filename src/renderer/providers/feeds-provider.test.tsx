// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { renderHook } from 'vitest-browser-react';
import {
  useAddFeed, useCreateCategory, useDeleteCategory, useDeleteFeed, useFeedsRefresh, useMoveFeeds, useReadState,
  useRenameCategory, useRiver, useSetShowInWorkspace,
} from './feeds-provider';
import { queryKeys } from '../lib/queries';
import { renderHookInWorkspace } from '../lib/test/render-hook-in-workspace';
import { dismissAllNotifications, NotificationHost } from '../lib/notifications';
import { uiKeys, useHasPendingRefresh, useIpcBridge } from '../lib/ipc-bridge';
import { renderWithQueryClient } from '../lib/test/render-with-query-client';
import { HOME_WORKSPACE_ID, type NewFeedInput, type RefreshSummary, type RiverPage, type RiverRow } from '../../shared/contracts';

let nextItemId = 1;

function createRow(overrides: Partial<RiverRow> = {}): RiverRow {
  const id = nextItemId++;
  return {
    id,
    title: `Item ${id}`,
    link: `https://example.com/item-${id}`,
    publishedAt: id,
    excerpt: '',
    image: undefined,
    readAt: undefined,
    feedId: 1,
    feedTitle: 'Feed A',
    feedLink: 'https://example.com/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    type: 'rss',
    ...overrides,
  };
}

function RiverRows() {
  const { data, fetchNextPage } = useRiver({ workspaceId: HOME_WORKSPACE_ID });
  const rows = data?.pages.flatMap((page) => page.rows) ?? [];
  return (
    <div>
      <ul>
        {rows.map((row) => (
          <li key={row.id}>{row.title}: {row.readAt ? 'read' : 'unread'}{row.image ? `: ${row.image}` : ''}</li>
        ))}
      </ul>
      <button type="button" onClick={() => void fetchNextPage()}>Load more</button>
    </div>
  );
}

function ReadStateButtons({ id, currentlyRead }: { id: number; currentlyRead: boolean }) {
  const { markRead, toggleRead } = useReadState();
  return (
    <div>
      <button type="button" onClick={() => markRead(id)}>Mark {id} read</button>
      <button type="button" onClick={() => toggleRead(id, currentlyRead)}>Toggle {id}</button>
    </div>
  );
}

function PendingState({ feedIds = [1] }: { feedIds?: number[] }) {
  const hasPending = useHasPendingRefresh(new Set(feedIds));
  return <span>{hasPending ? 'pending' : 'idle'}</span>;
}

function IpcBridgeMount() {
  useIpcBridge();
  return null;
}

function RefreshButton() {
  const { refreshNow, isRefreshing } = useFeedsRefresh();
  return <button type="button" onClick={refreshNow} disabled={isRefreshing}>Refresh feeds</button>;
}

let itemImageFetchedHandler: ((payload: { feedId: number; itemId: number; image: string }) => void) | undefined;
let feedsRefreshedHandler: ((payload: RefreshSummary) => void) | undefined;
let invokeImpl: (channel: string, arg: unknown) => Promise<unknown>;

beforeEach(() => {
  nextItemId = 1;
  itemImageFetchedHandler = undefined;
  feedsRefreshedHandler = undefined;
  invokeImpl = () => Promise.resolve({ rows: [] } satisfies RiverPage);
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn((channel: string, arg: unknown) => invokeImpl(channel, arg)),
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'feeds:item-image-fetched') {
          itemImageFetchedHandler = handler as typeof itemImageFetchedHandler;
        }
        if (channel === 'feeds:refreshed') {
          feedsRefreshedHandler = handler as typeof feedsRefreshedHandler;
        }
        return vi.fn();
      }),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

afterEach(async () => {
  // A dismissed toast frees its dedupe key only once its exit animation ends.
  if (document.querySelector('[data-sonner-toast]')) {
    dismissAllNotifications();
    await vi.waitFor(() => {
      expect(document.querySelector('[data-sonner-toast]')).toBeNull();
    });
  }
});

test('a partial refresh failure lets the user reveal the log file', async () => {
  // Arrange
  invokeImpl = () => Promise.resolve({ perFeed: [], failedFeeds: [{ feedId: 1, title: 'Alpha', message: 'offline' }, { feedId: 2, title: 'Beta', message: 'The server had an error (HTTP 502).' }] } satisfies RefreshSummary);
  const { getByText, getByRole } = await renderWithQueryClient(<><RefreshButton /><NotificationHost /></>);

  // Act
  await getByRole('button', { name: 'Refresh feeds' }).click();
  await expect.element(getByText('2 feeds could not be refreshed.', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Alpha: offline', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Beta: The server had an error (HTTP 502).', { exact: true })).toBeInTheDocument();
  await getByRole('button', { name: 'Show log file' }).click();

  // Assert
  expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('app:reveal-log-file', undefined);
});

test('a refresh with four failures names three feeds and counts the rest', async () => {
  // Arrange
  const failedFeeds = [1, 2, 3, 4].map((feedId) => ({ feedId, title: `Feed ${feedId}`, message: 'offline' }));
  invokeImpl = () => Promise.resolve({ perFeed: [], failedFeeds } satisfies RefreshSummary);
  const { getByText, getByRole } = await renderWithQueryClient(<><RefreshButton /><NotificationHost /></>);

  // Act
  await getByRole('button', { name: 'Refresh feeds' }).click();

  // Assert
  await expect.element(getByText('Feed 3: offline', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('and 1 more', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Feed 4: offline', { exact: true })).not.toBeInTheDocument();
});

test('loads the first page on mount', async () => {
  // Arrange
  const rowA = createRow({ title: 'Row A' });
  invokeImpl = (channel) => Promise.resolve(channel === 'items:query' ? { rows: [rowA] } satisfies RiverPage : []);

  // Act
  const { getByText } = await renderWithQueryClient(<RiverRows />);

  // Assert
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();
});

test('fetchNextPage appends the second page without dropping the first', async () => {
  // Arrange
  const rowA = createRow({ title: 'Row A' });
  const rowB = createRow({ title: 'Row B' });
  invokeImpl = (channel, arg) => {
    if (channel !== 'items:query') {
      return Promise.resolve([]);
    }
    const query = arg as { cursor?: unknown };
    return Promise.resolve(
      query.cursor
        ? ({ rows: [rowB] } satisfies RiverPage)
        : ({ rows: [rowA], nextCursor: { publishedAt: rowA.publishedAt, id: rowA.id } } satisfies RiverPage),
    );
  };
  const { getByText, getByRole } = await renderWithQueryClient(<RiverRows />);
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Load more' }).click();

  // Assert
  await expect.element(getByText('Row B: unread', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();
});

test('a feeds:refreshed push with new items marks the refresh pending without moving the river window', async () => {
  // Arrange
  const rowA = createRow({ title: 'Row A' });
  invokeImpl = (channel) => Promise.resolve(channel === 'items:query' ? { rows: [rowA] } satisfies RiverPage : []);
  const { getByText } = await renderWithQueryClient(
    <>
      <IpcBridgeMount />
      <PendingState />
      <RiverRows />
    </>,
  );
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();

  // Act
  feedsRefreshedHandler?.({ perFeed: [{ feedId: 1, inserted: 3 }] });

  // Assert
  await expect.element(getByText('pending', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();
});

test('publisher edits and removals leave the refresh idle', async () => {
  // Arrange
  const row = createRow({ title: 'Row A' });
  invokeImpl = (channel) => Promise.resolve(channel === 'items:query' ? { rows: [row] } satisfies RiverPage : []);
  const { getByText } = await renderWithQueryClient(<><IpcBridgeMount /><PendingState /><RiverRows /></>);
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();

  // Act
  feedsRefreshedHandler?.({ perFeed: [{ feedId: 1, inserted: 0, updated: 2 }], removed: 1 });

  // Assert
  await expect.element(getByText('idle', { exact: true })).toBeInTheDocument();
});

test('new items in a feed outside the given scope leave the refresh idle', async () => {
  // Arrange
  const row = createRow({ title: 'Row A' });
  invokeImpl = (channel) => Promise.resolve(channel === 'items:query' ? { rows: [row] } satisfies RiverPage : []);
  const { getByText } = await renderWithQueryClient(<><IpcBridgeMount /><PendingState feedIds={[1]} /><RiverRows /></>);
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();

  // Act
  feedsRefreshedHandler?.({ perFeed: [{ feedId: 2, inserted: 4 }] });

  // Assert
  await expect.element(getByText('idle', { exact: true })).toBeInTheDocument();
});

test('a manual refresh clears the pending state', async () => {
  // Arrange
  const row = createRow({ title: 'Row A' });
  invokeImpl = (channel) => Promise.resolve(channel === 'items:query' ? { rows: [row] } satisfies RiverPage : { perFeed: [] } satisfies RefreshSummary);
  const { getByText, getByRole } = await renderWithQueryClient(<><IpcBridgeMount /><PendingState /><RiverRows /><RefreshButton /></>);
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();
  feedsRefreshedHandler?.({ perFeed: [{ feedId: 1, inserted: 3 }] });
  await expect.element(getByText('pending', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Refresh feeds' }).click();

  // Assert
  await expect.element(getByText('idle', { exact: true })).toBeInTheDocument();
});

test('a refresh applied immediately clears the pending state', async () => {
  // Arrange
  const row = createRow({ title: 'Row A' });
  invokeImpl = (channel) => Promise.resolve(channel === 'items:query' ? { rows: [row] } satisfies RiverPage : []);
  const { getByText } = await renderWithQueryClient(<><IpcBridgeMount /><PendingState /><RiverRows /></>);
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();
  feedsRefreshedHandler?.({ perFeed: [{ feedId: 1, inserted: 3 }] });
  await expect.element(getByText('pending', { exact: true })).toBeInTheDocument();

  // Act
  feedsRefreshedHandler?.({ perFeed: [], removed: 2, applyImmediately: true });

  // Assert
  await expect.element(getByText('idle', { exact: true })).toBeInTheDocument();
});

test('a feeds:refreshed push before the river has ever rendered leaves the refresh idle', async () => {
  // Arrange: the river's first fetch never resolves, so the window has nothing loaded yet —
  // exactly the launch race, where a pending state here would have nothing left to load once that
  // fetch eventually lands on its own.
  invokeImpl = (channel) => (channel === 'items:query' ? new Promise(() => { }) : Promise.resolve([]));
  const { getByText } = await renderWithQueryClient(
    <>
      <IpcBridgeMount />
      <PendingState />
      <RiverRows />
    </>,
  );

  // Act
  feedsRefreshedHandler?.({ perFeed: [{ feedId: 1, inserted: 3 }] });

  // Assert
  await expect.element(getByText('idle', { exact: true })).toBeInTheDocument();
});

test('a feeds:item-image-fetched push patches exactly one row', async () => {
  // Arrange
  const target = createRow({ title: 'Target' });
  const other = createRow({ title: 'Other' });
  invokeImpl = (channel) => Promise.resolve(channel === 'items:query' ? { rows: [target, other] } satisfies RiverPage : []);
  const { getByText } = await renderWithQueryClient(
    <>
      <IpcBridgeMount />
      <RiverRows />
    </>,
  );
  await expect.element(getByText('Target: unread', { exact: true })).toBeInTheDocument();

  // Act
  itemImageFetchedHandler?.({ feedId: target.feedId, itemId: target.id, image: 'https://example.com/fetched.jpg' });

  // Assert
  await expect.element(getByText('Target: unread: https://example.com/fetched.jpg', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Other: unread', { exact: true })).toBeInTheDocument();
});

test('marking an item read updates it optimistically and keeps it once the write succeeds', async () => {
  // Arrange
  const row = createRow({ title: 'Row A' });
  invokeImpl = (channel) => Promise.resolve(
    channel === 'items:query' ? ({ rows: [row] } satisfies RiverPage)
      : channel === 'items:set-read' ? { success: true, data: undefined }
        : [],
  );
  const { getByText, getByRole } = await renderWithQueryClient(
    <>
      <RiverRows />
      <ReadStateButtons id={row.id} currentlyRead={false} />
    </>,
  );
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: `Mark ${row.id} read` }).click();

  // Assert
  await expect.element(getByText('Row A: read', { exact: true })).toBeInTheDocument();
});

test('a rejected items:set-read rolls back the optimistic read state', async () => {
  // Arrange
  const row = createRow({ title: 'Row A' });
  invokeImpl = (channel) => (channel === 'items:query'
    ? Promise.resolve({ rows: [row] } satisfies RiverPage)
    : channel === 'items:set-read'
      ? Promise.reject(new Error('offline'))
      : Promise.resolve([]));
  const { getByText, getByRole } = await renderWithQueryClient(
    <>
      <RiverRows />
      <ReadStateButtons id={row.id} currentlyRead={false} />
    </>,
  );
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: `Mark ${row.id} read` }).click();

  // Assert: read immediately (optimistic), then rolled back once the write fails.
  await vi.waitFor(() => {
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('log:write', expect.objectContaining({ level: 'error' }));
  });
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();
});

test('two read-state mutations racing each keep their own outcome', async () => {
  // Arrange: item A's write is slow and fails; item B's write is fast and succeeds.
  const rowA = createRow({ title: 'Row A' });
  const rowB = createRow({ title: 'Row B' });
  let resolveA!: () => void;
  const pendingA = new Promise<void>((resolve) => {
    resolveA = resolve;
  });
  invokeImpl = (channel, arg) => {
    if (channel === 'items:query') {
      return Promise.resolve({ rows: [rowA, rowB] } satisfies RiverPage);
    }
    if (channel === 'items:set-read') {
      const { itemIds } = arg as { itemIds: number[] };
      if (itemIds.includes(rowA.id)) {
        return pendingA.then(() => ({ success: false, error: { name: 'ITEM_NOT_FOUND', message: 'gone' } }) as const);
      }
      return Promise.resolve({ success: true, data: undefined });
    }
    return Promise.resolve([]);
  };
  const { getByText, getByRole } = await renderWithQueryClient(
    <>
      <RiverRows />
      <ReadStateButtons id={rowA.id} currentlyRead={false} />
      <ReadStateButtons id={rowB.id} currentlyRead={false} />
    </>,
  );
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();

  // Act: start A's slow mutation, then B's fast one, which settles first.
  await getByRole('button', { name: `Mark ${rowA.id} read` }).click();
  await getByRole('button', { name: `Mark ${rowB.id} read` }).click();
  await expect.element(getByText('Row B: read', { exact: true })).toBeInTheDocument();
  resolveA();

  // Assert: A rolls back to unread, B stays read, neither mutation clobbered the other's row.
  await vi.waitFor(() => {
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('log:write', expect.objectContaining({ level: 'error' }));
  });
  await expect.element(getByText('Row A: unread', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Row B: read', { exact: true })).toBeInTheDocument();
});

const HOME_RIVER = { workspaceId: HOME_WORKSPACE_ID };
const SEEDED_KEYS = {
  feeds: queryKeys.feeds(HOME_WORKSPACE_ID),
  categories: queryKeys.categories(HOME_WORKSPACE_ID),
  river: queryKeys.river(HOME_RIVER),
  workspaces: queryKeys.workspaces,
  unrelated: queryKeys.appInfo,
};

async function renderProviderHook<T>(hook: () => T) {
  const queryClient = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  for (const key of Object.values(SEEDED_KEYS)) {
    queryClient.setQueryData(key, []);
  }
  queryClient.setQueryData(SEEDED_KEYS.river, { pages: [], pageParams: [] });
  const wrapper = ({ children }: PropsWithChildren) => <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  const rendered = await renderHook(hook, { wrapper });
  return { queryClient, ...rendered };
}

function invalidatedQueries(queryClient: QueryClient): string[] {
  return Object.entries(SEEDED_KEYS)
    .filter(([, key]) => queryClient.getQueryState(key)?.isInvalidated)
    .map(([name]) => name)
    .sort();
}

const DB_FAILURE = { success: false, error: { name: 'DB_ERROR', message: 'disk full' } } as const;

const newFeed: Omit<NewFeedInput, 'workspaceId'> = { link: 'https://example.com/feed.xml', title: 'Example', type: 'rss', items: [], categoryName: 'Tech', showInWorkspace: true };

interface MutationCase {
  name: string;
  run: () => Promise<{ returned: unknown; queryClient: QueryClient }>;
  channel: string;
  payload: unknown;
  invalidates: string[];
}

async function runHook<T extends (...args: never[]) => Promise<unknown>>(hook: () => T, call: (action: T) => Promise<unknown>) {
  const { result, queryClient } = await renderProviderHook(hook);
  const returned = await call(result.current);
  return { returned, queryClient };
}

const MUTATION_CASES: MutationCase[] = [
  {
    name: 'useAddFeed',
    run: () => runHook(useAddFeed, (add) => add(newFeed)),
    channel: 'feeds:submit-add-feed',
    payload: { ...newFeed, workspaceId: HOME_WORKSPACE_ID },
    invalidates: ['categories', 'feeds', 'river'],
  },
  {
    name: 'useDeleteFeed',
    run: () => runHook(useDeleteFeed, (remove) => remove(7)),
    channel: 'feeds:delete-feed',
    payload: { feedId: 7, workspaceId: HOME_WORKSPACE_ID },
    invalidates: ['feeds', 'river'],
  },
  {
    name: 'useSetShowInWorkspace',
    run: () => runHook(useSetShowInWorkspace, (setShow) => setShow([4, 5], false)),
    channel: 'feeds:set-show-in-workspace',
    payload: { feedIds: [4, 5], showInWorkspace: false, workspaceId: HOME_WORKSPACE_ID },
    invalidates: ['feeds', 'river'],
  },
  {
    name: 'useCreateCategory',
    run: () => runHook(useCreateCategory, (create) => create('News')),
    channel: 'feeds:create-category',
    payload: { name: 'News', workspaceId: HOME_WORKSPACE_ID },
    invalidates: ['categories'],
  },
  {
    name: 'useRenameCategory',
    run: () => runHook(useRenameCategory, (rename) => rename(3, 'Science')),
    channel: 'feeds:rename-category',
    payload: { categoryId: 3, name: 'Science', workspaceId: HOME_WORKSPACE_ID },
    invalidates: ['categories', 'feeds', 'river'],
  },
  {
    name: 'useDeleteCategory',
    run: () => runHook(useDeleteCategory, (remove) => remove(3, 4)),
    channel: 'feeds:delete-category',
    payload: { categoryId: 3, reassignTo: 4, workspaceId: HOME_WORKSPACE_ID },
    invalidates: ['categories', 'feeds', 'river'],
  },
  {
    name: 'useMoveFeeds',
    run: () => runHook(useMoveFeeds, (move) => move([4, 5], 3)),
    channel: 'feeds:move-feeds-to-category',
    payload: { feedIds: [4, 5], categoryId: 3, workspaceId: HOME_WORKSPACE_ID },
    invalidates: ['feeds', 'river'],
  },
];

describe.each(MUTATION_CASES)('$name', ({ run, channel, payload, invalidates }) => {
  test('sends the request for the active workspace and refreshes the queries it changed', async () => {
    // Arrange
    const success = { success: true, data: { id: 1 } };
    invokeImpl = () => Promise.resolve(success);

    // Act
    const { returned, queryClient } = await run();

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(channel, payload);
    expect(returned).toEqual(success);
    expect(invalidatedQueries(queryClient)).toEqual(invalidates);
  });

  test('returns the error and refreshes nothing when the request fails', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve(DB_FAILURE);

    // Act
    const { returned, queryClient } = await run();

    // Assert
    expect(returned).toEqual(DB_FAILURE);
    expect(invalidatedQueries(queryClient)).toEqual([]);
  });
});

function switchCase<T extends (...args: never[]) => Promise<unknown>>(
  name: string,
  hook: () => T,
  call: (action: T) => Promise<unknown>,
  channel: string,
): [string, () => Promise<void>, string] {
  return [name, async () => {
    const { result, goToWorkspace } = await renderHookInWorkspace(hook);
    await goToWorkspace(3);
    await call(result.current);
  }, channel];
}

test.each([
  switchCase('useAddFeed', useAddFeed, (add) => add(newFeed), 'feeds:submit-add-feed'),
  switchCase('useDeleteFeed', useDeleteFeed, (remove) => remove(7), 'feeds:delete-feed'),
  switchCase('useSetShowInWorkspace', useSetShowInWorkspace, (setShow) => setShow([4], true), 'feeds:set-show-in-workspace'),
  switchCase('useRenameCategory', useRenameCategory, (rename) => rename(3, 'Science'), 'feeds:rename-category'),
  switchCase('useDeleteCategory', useDeleteCategory, (remove) => remove(3, 4), 'feeds:delete-category'),
  switchCase('useMoveFeeds', useMoveFeeds, (move) => move([4], 3), 'feeds:move-feeds-to-category'),
  switchCase('useCreateCategory', useCreateCategory, (create) => create('News'), 'feeds:create-category'),
])('%s acts on the workspace that is active when it is called', async (_name, run, channel) => {
  // Arrange
  invokeImpl = () => Promise.resolve({ success: true, data: undefined });

  // Act
  await run();

  // Assert
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith(channel, expect.objectContaining({ workspaceId: 3 }));
});

function seedRiver(queryClient: QueryClient, rows: RiverRow[]): void {
  queryClient.setQueryData(SEEDED_KEYS.river, { pages: [{ rows }], pageParams: [undefined] });
}

function riverRows(queryClient: QueryClient): RiverRow[] {
  return queryClient.getQueryData<{ pages: RiverPage[] }>(SEEDED_KEYS.river)?.pages.flatMap((page) => page.rows) ?? [];
}

describe('useReadState', () => {
  test('markAllRead marks every given row read in one request and leaves the others alone', async () => {
    // Arrange
    const [a, b, other] = [createRow(), createRow(), createRow()];
    invokeImpl = () => Promise.resolve({ success: true, data: undefined });
    const { result, queryClient } = await renderProviderHook(useReadState);
    seedRiver(queryClient, [a, b, other]);

    // Act
    result.current.markAllRead([a.id, b.id]);

    // Assert
    await vi.waitFor(() => {
      expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('items:set-read', { itemIds: [a.id, b.id], read: true });
    });
    const isIsoTime = (readAt: string | undefined) => readAt !== undefined && new Date(readAt).toISOString() === readAt;
    expect(riverRows(queryClient).map((row) => isIsoTime(row.readAt))).toEqual([true, true, false]);
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledTimes(1);
  });

  test('markAllRead with no ids sends nothing', async () => {
    // Arrange
    const { result } = await renderProviderHook(useReadState);

    // Act
    result.current.markAllRead([]);

    // Assert
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(window.electron.ipcRenderer.invoke).not.toHaveBeenCalled();
  });

  test('stops a river load that is under way, so a stale page cannot undo the change, and leaves other loads alone', async () => {
    // Arrange
    const row = createRow();
    invokeImpl = () => Promise.resolve({ success: true, data: undefined });
    const { result, queryClient } = await renderProviderHook(useReadState);
    seedRiver(queryClient, [row]);
    const neverEnds = () => new Promise<never>(() => { });
    void queryClient.fetchQuery({ queryKey: SEEDED_KEYS.river, queryFn: neverEnds, staleTime: 0 }).catch(() => undefined);
    void queryClient.fetchQuery({ queryKey: SEEDED_KEYS.unrelated, queryFn: neverEnds }).catch(() => undefined);
    expect(queryClient.getQueryState(SEEDED_KEYS.river)?.fetchStatus).toBe('fetching');

    // Act
    result.current.markRead(row.id);

    // Assert
    await vi.waitFor(() => {
      expect(queryClient.getQueryState(SEEDED_KEYS.river)?.fetchStatus).toBe('idle');
    });
    expect(queryClient.getQueryState(SEEDED_KEYS.unrelated)?.fetchStatus).toBe('fetching');
  });

  test('toggleRead on a read row marks it unread', async () => {
    // Arrange
    const row = createRow({ readAt: '2026-01-01T00:00:00.000Z' });
    invokeImpl = () => Promise.resolve({ success: true, data: undefined });
    const { result, queryClient } = await renderProviderHook(useReadState);
    seedRiver(queryClient, [row]);

    // Act
    result.current.toggleRead(row.id, true);

    // Assert
    await vi.waitFor(() => {
      expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('items:set-read', { itemIds: [row.id], read: false });
    });
    expect(riverRows(queryClient).map((item) => item.readAt)).toEqual([undefined]);
  });

  test('toggleRead on an unread row marks it read', async () => {
    // Arrange
    const row = createRow();
    invokeImpl = () => Promise.resolve({ success: true, data: undefined });
    const { result, queryClient } = await renderProviderHook(useReadState);
    seedRiver(queryClient, [row]);

    // Act
    result.current.toggleRead(row.id, false);

    // Assert
    await vi.waitFor(() => {
      expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('items:set-read', { itemIds: [row.id], read: true });
    });
    expect(riverRows(queryClient).map((item) => item.readAt)).toEqual([expect.any(String)]);
  });

  test('a refused write restores the prior read time of each row it touched', async () => {
    // Arrange
    const readTime = '2026-01-01T00:00:00.000Z';
    const read = createRow({ readAt: readTime });
    const unread = createRow();
    const untouched = createRow({ readAt: '2026-02-02T00:00:00.000Z' });
    invokeImpl = () => Promise.resolve({ success: false, error: { name: 'ITEM_NOT_FOUND', message: 'gone' } });
    const { result, queryClient } = await renderProviderHook(useReadState);
    seedRiver(queryClient, [read, unread, untouched]);

    // Act
    result.current.markAllRead([read.id, unread.id]);

    // Assert
    await vi.waitFor(() => {
      expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('log:write', expect.objectContaining({ level: 'error' }));
    });
    expect(riverRows(queryClient).map((row) => row.readAt)).toEqual([readTime, undefined, '2026-02-02T00:00:00.000Z']);
  });

  test.each([
    ['succeeds', { success: true, data: undefined }],
    ['is refused', { success: false, error: { name: 'ITEM_NOT_FOUND', message: 'gone' } }],
  ])('refreshes the feed list for the sidebar counts when the write %s', async (_name, response) => {
    // Arrange
    invokeImpl = () => Promise.resolve(response);
    const { result, queryClient } = await renderProviderHook(useReadState);

    // Act
    result.current.markRead(1);

    // Assert
    await vi.waitFor(() => {
      expect(invalidatedQueries(queryClient)).toEqual(['feeds']);
    });
  });
});

describe('useFeedsRefresh', () => {
  test('a manual refresh reloads the feeds and the river, clears the pending refresh and bumps the applied version', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve({ perFeed: [] } satisfies RefreshSummary);
    const { result, queryClient } = await renderProviderHook(useFeedsRefresh);
    queryClient.setQueryData(uiKeys.pendingRefreshFeedIds, [1, 2]);
    queryClient.setQueryData(uiKeys.appliedRefreshVersion, 4);

    // Act
    result.current.refreshNow();

    // Assert
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(uiKeys.appliedRefreshVersion)).toBe(5);
    });
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('feeds:refresh', undefined);
    expect(queryClient.getQueryData(uiKeys.pendingRefreshFeedIds)).toEqual([]);
    expect(invalidatedQueries(queryClient)).toEqual(['feeds', 'river']);
  });

  test('the first applied refresh sets the version to 1', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve({ perFeed: [] } satisfies RefreshSummary);
    const { result, queryClient } = await renderProviderHook(useFeedsRefresh);

    // Act
    result.current.refreshNow();

    // Assert
    await vi.waitFor(() => {
      expect(queryClient.getQueryData(uiKeys.appliedRefreshVersion)).toBe(1);
    });
  });

  test('reports a single failed feed in the singular', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve({ perFeed: [], failedFeeds: [{ feedId: 3, title: 'Gamma', message: 'offline' }] } satisfies RefreshSummary);
    const { getByText, getByRole } = await renderWithQueryClient(<><RefreshButton /><NotificationHost /></>);

    // Act
    await getByRole('button', { name: 'Refresh feeds' }).click();

    // Assert
    await expect.element(getByText('1 feed could not be refreshed.', { exact: true })).toBeInTheDocument();
  });

  test.each([
    ['an empty list of failed feeds', { perFeed: [], failedFeeds: [] }],
    ['no list of failed feeds', { perFeed: [] }],
  ] satisfies [string, RefreshSummary][])('shows no warning for %s', async (_name, summary) => {
    // Arrange
    invokeImpl = () => Promise.resolve(summary);
    const { getByText, getByRole } = await renderWithQueryClient(<><RefreshButton /><NotificationHost /></>);

    // Act
    await getByRole('button', { name: 'Refresh feeds' }).click();

    // Assert
    await vi.waitFor(() => {
      expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('feeds:refresh', undefined);
    });
    await expect.element(getByRole('button', { name: 'Refresh feeds' })).toBeEnabled();
    await expect.element(getByText('could not be refreshed')).not.toBeInTheDocument();
  });

  test('reports a failed refresh and goes back to idle', async () => {
    // Arrange
    let rejectRefresh!: (error: Error) => void;
    invokeImpl = () => new Promise((_resolve, reject) => {
      rejectRefresh = reject;
    });
    const { result } = await renderProviderHook(useFeedsRefresh);
    expect(result.current).toMatchObject({ isRefreshing: false, refreshFailed: false });

    // Act
    result.current.refreshNow();

    // Assert
    await vi.waitFor(() => {
      expect(result.current.isRefreshing).toBe(true);
    });
    rejectRefresh(new Error('offline'));
    await vi.waitFor(() => {
      expect(result.current).toMatchObject({ isRefreshing: false, refreshFailed: true });
    });
    expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('log:write', expect.objectContaining({ level: 'error' }));
  });
});
