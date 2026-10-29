// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { useFeedsRefresh, useReadState, useRiver } from './feeds-provider';
import { dismissAllNotifications, NotificationHost } from '../lib/notifications';
import { useHasPendingRefresh, useIpcBridge } from '../lib/ipc-bridge';
import { renderWithQueryClient } from '../lib/test/render-with-query-client';
import { HOME_WORKSPACE_ID, type RefreshSummary, type RiverPage, type RiverRow } from '../../shared/contracts';

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

afterEach(() => {
  dismissAllNotifications();
});

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
