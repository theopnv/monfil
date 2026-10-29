// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { QueryClient, QueryClientProvider, type InfiniteData } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-react';
import type { ReactElement } from 'react';
import {
  uiKeys,
  useApplyPendingRefresh,
  useAppliedRefreshVersion,
  useClearDeleteCategoryRequest,
  useClearDeleteFeedRequest,
  useClearDeleteWorkspaceRequest,
  useClearEditWorkspaceRequest,
  useClearExportWorkspaceRequest,
  useClearRenameCategoryRequest,
  useDeleteCategoryRequestedId,
  useDeleteFeedRequestedId,
  useDeleteWorkspaceRequestedId,
  useEditWorkspaceRequestedId,
  useExportWorkspaceRequestedId,
  useFeedpackRefreshing,
  useHasPendingRefresh,
  useIpcBridge,
  useRenameCategoryRequestedId,
} from './ipc-bridge';
import type { RefreshSummary, RiverPage, RiverRow } from '../../shared/contracts';

// Seeded data has no observer, so the default gcTime of 0 would drop it before the test reads it.
function createTestQueryClient(): QueryClient {
  return new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
}

const handlers = new Map<string, (payload: never) => void>();
const unsubscribers = new Map<string, ReturnType<typeof vi.fn>>();

beforeEach(() => {
  handlers.clear();
  unsubscribers.clear();
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn(() => Promise.resolve([])),
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        const unsubscribe = vi.fn();
        handlers.set(channel, handler);
        unsubscribers.set(channel, unsubscribe);
        return unsubscribe;
      }),
      once: vi.fn(),
      sendMessage: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

function emit(channel: string, payload: unknown): void {
  const handler = handlers.get(channel);
  if (!handler) {
    throw new Error(`No listener for ${channel}`);
  }
  handler(payload as never);
}

function under(client: QueryClient, child: ReactElement): ReactElement {
  return <QueryClientProvider client={client}>{child}</QueryClientProvider>;
}

function Bridge() {
  useIpcBridge();
  return null;
}

async function mountBridge(client: QueryClient) {
  const screen = await render(under(client, <Bridge />));
  await expect.poll(() => handlers.size).toBe(10);
  return screen;
}

function row(id: number, image?: string): RiverRow {
  return {
    id,
    title: `Item ${id}`,
    link: undefined,
    publishedAt: id,
    excerpt: '',
    image,
    readAt: undefined,
    feedId: 1,
    feedTitle: 'Feed',
    feedLink: 'https://example.com',
    feedIcon: undefined,
    categoryName: 'News',
    type: 'rss',
  };
}

function riverData(...rows: RiverRow[]): InfiniteData<RiverPage> {
  return { pages: [{ rows }], pageParams: [undefined] };
}

function isInvalidated(client: QueryClient, key: readonly unknown[]): boolean | undefined {
  return client.getQueryState(key)?.isInvalidated;
}

const RIVER_A = ['river', { name: 'a' }] as const;
const RIVER_B = ['river', { name: 'b' }] as const;

function refreshed(summary: RefreshSummary): RefreshSummary {
  return summary;
}

describe('useIpcBridge', () => {
  describe('feeds:refreshed with applyImmediately', () => {
    test('clears the pending feeds, raises the applied version and invalidates the rivers', async () => {
      // Arrange
      const client = createTestQueryClient();
      client.setQueryData(uiKeys.pendingRefreshFeedIds, [1, 2]);
      client.setQueryData(uiKeys.appliedRefreshVersion, 3);
      client.setQueryData(RIVER_A, riverData(row(1)));
      client.setQueryData(['feeds', 1], []);
      client.setQueryData(['app-info'], {});
      await mountBridge(client);

      // Act
      emit('feeds:refreshed', refreshed({ perFeed: [{ feedId: 9, inserted: 2 }], applyImmediately: true }));

      // Assert
      expect(client.getQueryData(uiKeys.pendingRefreshFeedIds)).toEqual([]);
      expect(client.getQueryData(uiKeys.appliedRefreshVersion)).toBe(4);
      expect(isInvalidated(client, RIVER_A)).toBe(true);
      expect(isInvalidated(client, ['feeds', 1])).toBe(true);
      expect(isInvalidated(client, ['app-info'])).toBe(true);
    });

    test('starts the applied version at one when none was set', async () => {
      // Arrange
      const client = createTestQueryClient();
      await mountBridge(client);

      // Act
      emit('feeds:refreshed', refreshed({ perFeed: [], applyImmediately: true }));

      // Assert
      expect(client.getQueryData(uiKeys.appliedRefreshVersion)).toBe(1);
    });
  });

  describe('feeds:refreshed without applyImmediately', () => {
    test('adds the feeds with new items to the pending list once, and leaves the rivers alone', async () => {
      // Arrange
      const client = createTestQueryClient();
      client.setQueryData(uiKeys.pendingRefreshFeedIds, [3]);
      client.setQueryData(uiKeys.appliedRefreshVersion, 5);
      client.setQueryData(RIVER_A, riverData(row(1)));
      client.setQueryData(['feeds', 1], []);
      client.setQueryData(['app-info'], {});
      await mountBridge(client);

      // Act
      emit('feeds:refreshed', refreshed({
        perFeed: [
          { feedId: 1, inserted: 2 },
          { feedId: 2, inserted: 0, updated: 4 },
          { feedId: 3, inserted: 1 },
        ],
      }));

      // Assert
      expect(client.getQueryData(uiKeys.pendingRefreshFeedIds)).toEqual([3, 1]);
      expect(client.getQueryData(uiKeys.appliedRefreshVersion)).toBe(5);
      expect(isInvalidated(client, RIVER_A)).toBe(false);
      expect(isInvalidated(client, ['feeds', 1])).toBe(true);
      expect(isInvalidated(client, ['app-info'])).toBe(true);
    });

    test('raises no pill when no feed inserted an item', async () => {
      // Arrange
      const client = createTestQueryClient();
      client.setQueryData(RIVER_A, riverData(row(1)));
      await mountBridge(client);

      // Act
      emit('feeds:refreshed', refreshed({ perFeed: [{ feedId: 1, inserted: 0, updated: 2 }] }));

      // Assert
      expect(client.getQueryData(uiKeys.pendingRefreshFeedIds)).toBeUndefined();
    });

    test('raises no pill before any river has data', async () => {
      // Arrange
      const client = createTestQueryClient();
      client.setQueryData(['feeds', 1], []);
      void client.prefetchQuery({ queryKey: RIVER_A, queryFn: () => new Promise<never>(() => undefined) });
      await mountBridge(client);

      // Act
      emit('feeds:refreshed', refreshed({ perFeed: [{ feedId: 1, inserted: 3 }] }));

      // Assert
      expect(client.getQueryData(uiKeys.pendingRefreshFeedIds)).toBeUndefined();
    });

    test('raises the pill when one river has data and another is still loading', async () => {
      // Arrange
      const client = createTestQueryClient();
      client.setQueryData(RIVER_A, riverData(row(1)));
      void client.prefetchQuery({ queryKey: RIVER_B, queryFn: () => new Promise<never>(() => undefined) });
      await mountBridge(client);

      // Act
      emit('feeds:refreshed', refreshed({ perFeed: [{ feedId: 4, inserted: 1 }] }));

      // Assert
      expect(client.getQueryData(uiKeys.pendingRefreshFeedIds)).toEqual([4]);
    });
  });

  test('feeds:item-image-fetched sets the image of that item in every river and nowhere else', async () => {
    // Arrange
    const client = createTestQueryClient();
    client.setQueryData(RIVER_A, riverData(row(1), row(2)));
    client.setQueryData(RIVER_B, riverData(row(2), row(3, 'old.png')));
    client.setQueryData(['not-a-river'], riverData(row(2)));
    void client.prefetchQuery({ queryKey: ['river', { name: 'loading' }], queryFn: () => new Promise<never>(() => undefined) });
    await mountBridge(client);

    // Act
    emit('feeds:item-image-fetched', { feedId: 1, itemId: 2, image: 'new.png' });

    // Assert
    expect(client.getQueryData<InfiniteData<RiverPage>>(RIVER_A)?.pages[0]?.rows.map((r) => r.image)).toEqual([undefined, 'new.png']);
    expect(client.getQueryData<InfiniteData<RiverPage>>(RIVER_B)?.pages[0]?.rows.map((r) => r.image)).toEqual(['new.png', 'old.png']);
    expect(client.getQueryData<InfiniteData<RiverPage>>(['not-a-river'])?.pages[0]?.rows[0]?.image).toBeUndefined();
  });

  test('feedpacks:install-finished ends the refresh of that workspace and invalidates its feeds and the rivers', async () => {
    // Arrange
    const client = createTestQueryClient();
    client.setQueryData(uiKeys.feedpackRefreshing(1), true);
    client.setQueryData(uiKeys.feedpackRefreshing(2), true);
    client.setQueryData(['feeds', 1], []);
    client.setQueryData(['feeds', 2], []);
    client.setQueryData(RIVER_A, riverData(row(1)));
    await mountBridge(client);

    // Act
    emit('feedpacks:install-finished', { workspaceId: 1, imported: 2, failed: [] });

    // Assert
    expect(client.getQueryData(uiKeys.feedpackRefreshing(1))).toBe(false);
    expect(client.getQueryData(uiKeys.feedpackRefreshing(2))).toBe(true);
    expect(isInvalidated(client, ['feeds', 1])).toBe(true);
    expect(isInvalidated(client, ['feeds', 2])).toBe(false);
    expect(isInvalidated(client, RIVER_A)).toBe(true);
  });

  test('app:update-state-changed stores the new update state', async () => {
    // Arrange
    const client = createTestQueryClient();
    await mountBridge(client);

    // Act
    emit('app:update-state-changed', { name: 'READY_TO_INSTALL' });

    // Assert
    expect(client.getQueryData(['app-update-state'])).toEqual({ name: 'READY_TO_INSTALL' });
  });

  test('stops every listener on unmount', async () => {
    // Arrange
    const screen = await mountBridge(createTestQueryClient());

    // Act
    await screen.unmount();

    // Assert
    expect([...unsubscribers.values()].map((unsubscribe) => unsubscribe.mock.calls.length)).toEqual(Array(10).fill(1));
  });

  test('listens for the new client when the query client changes', async () => {
    // Arrange
    const first = createTestQueryClient();
    const second = createTestQueryClient();
    const screen = await mountBridge(first);

    // Act
    await screen.rerender(under(second, <Bridge />));
    emit('app:update-state-changed', { name: 'READY_TO_INSTALL' });

    // Assert
    expect(second.getQueryData(['app-update-state'])).toEqual({ name: 'READY_TO_INSTALL' });
    expect(first.getQueryData(['app-update-state'])).toBeUndefined();
  });
});

function PendingProbe({ feedIds }: { feedIds: number[] }) {
  const pending = useHasPendingRefresh(new Set(feedIds));
  const version = useAppliedRefreshVersion();
  const apply = useApplyPendingRefresh();
  return (
    <>
      <output>{`pending:${pending} version:${version}`}</output>
      <button onClick={apply}>Apply</button>
    </>
  );
}

describe('pending refresh hooks', () => {
  test('a refresh with new items raises the pill for the feeds it touched until it is applied', async () => {
    // Arrange
    const client = createTestQueryClient();
    client.setQueryData(RIVER_A, riverData(row(1)));
    await render(under(client, <><Bridge /><PendingProbe feedIds={[1, 2]} /></>));
    await expect.element(page.getByRole('status')).toHaveTextContent('pending:false version:0');

    // Act
    emit('feeds:refreshed', refreshed({ perFeed: [{ feedId: 2, inserted: 1 }, { feedId: 8, inserted: 1 }] }));

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('pending:true version:0');

    // Act
    await page.getByRole('button', { name: 'Apply' }).click();

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('pending:false version:1');
    expect(client.getQueryData(uiKeys.pendingRefreshFeedIds)).toEqual([]);
    expect(isInvalidated(client, RIVER_A)).toBe(true);
  });

  test('a pending refresh of other feeds does not raise the pill', async () => {
    // Arrange
    const client = createTestQueryClient();
    client.setQueryData(uiKeys.pendingRefreshFeedIds, [8, 9]);

    // Act
    await render(under(client, <PendingProbe feedIds={[1, 2]} />));

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('pending:false version:0');
  });

  test('applying a pending refresh adds one to the applied version', async () => {
    // Arrange
    const client = createTestQueryClient();
    client.setQueryData(uiKeys.appliedRefreshVersion, 6);
    await render(under(client, <PendingProbe feedIds={[1]} />));

    // Act
    await page.getByRole('button', { name: 'Apply' }).click();

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('pending:false version:7');
  });

  test('applying after the query client changed writes to the new client', async () => {
    // Arrange
    const first = createTestQueryClient();
    const second = createTestQueryClient();
    second.setQueryData(RIVER_A, riverData(row(1)));
    const screen = await render(under(first, <PendingProbe feedIds={[1]} />));
    await screen.rerender(under(second, <PendingProbe feedIds={[1]} />));

    // Act
    await page.getByRole('button', { name: 'Apply' }).click();

    // Assert
    expect(second.getQueryData(uiKeys.appliedRefreshVersion)).toBe(1);
    expect(isInvalidated(second, RIVER_A)).toBe(true);
  });
});

function RefreshingProbe({ workspaceId }: { workspaceId: number | undefined }) {
  return <output>{String(useFeedpackRefreshing(workspaceId))}</output>;
}

describe('useFeedpackRefreshing', () => {
  test('follows the refreshing flag of its workspace until the install finishes', async () => {
    // Arrange
    const client = createTestQueryClient();
    client.setQueryData(uiKeys.feedpackRefreshing(1), true);
    client.setQueryData(uiKeys.feedpackRefreshing(2), false);
    await render(under(client, <><Bridge /><RefreshingProbe workspaceId={1} /></>));
    await expect.element(page.getByRole('status')).toHaveTextContent('true');

    // Act
    emit('feedpacks:install-finished', { workspaceId: 1, imported: 0, failed: [] });

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('false');
  });

  test('reads false without a workspace, whatever the other workspaces do', async () => {
    // Arrange
    const client = createTestQueryClient();
    client.setQueryData(uiKeys.feedpackRefreshing(1), true);

    // Act
    await render(under(client, <RefreshingProbe workspaceId={undefined} />));

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('false');
  });
});

interface RequestCase {
  channel: string;
  key: readonly unknown[];
  useRequestedId: () => number | null;
  useClear: () => () => void;
}

const requestCases: RequestCase[] = [
  { channel: 'feeds:delete-feed-requested', key: uiKeys.deleteFeedRequestedId, useRequestedId: useDeleteFeedRequestedId, useClear: useClearDeleteFeedRequest },
  { channel: 'feeds:rename-category-requested', key: uiKeys.renameCategoryRequestedId, useRequestedId: useRenameCategoryRequestedId, useClear: useClearRenameCategoryRequest },
  { channel: 'feeds:delete-category-requested', key: uiKeys.deleteCategoryRequestedId, useRequestedId: useDeleteCategoryRequestedId, useClear: useClearDeleteCategoryRequest },
  { channel: 'workspaces:edit-requested', key: uiKeys.editWorkspaceRequestedId, useRequestedId: useEditWorkspaceRequestedId, useClear: useClearEditWorkspaceRequest },
  { channel: 'workspaces:export-requested', key: uiKeys.exportWorkspaceRequestedId, useRequestedId: useExportWorkspaceRequestedId, useClear: useClearExportWorkspaceRequest },
  { channel: 'workspaces:delete-requested', key: uiKeys.deleteWorkspaceRequestedId, useRequestedId: useDeleteWorkspaceRequestedId, useClear: useClearDeleteWorkspaceRequest },
];

function RequestProbe({ useRequestedId, useClear }: Pick<RequestCase, 'useRequestedId' | 'useClear'>) {
  const id = useRequestedId();
  const clear = useClear();
  return (
    <>
      <output>{String(id)}</output>
      <button onClick={clear}>Clear</button>
    </>
  );
}

describe.each(requestCases)('$channel', ({ channel, key, useRequestedId, useClear }) => {
  test('shows the requested ID until the request is cleared', async () => {
    // Arrange
    const client = createTestQueryClient();
    await render(under(client, <><Bridge /><RequestProbe useRequestedId={useRequestedId} useClear={useClear} /></>));
    await expect.poll(() => handlers.size).toBe(10);
    await expect.element(page.getByRole('status')).toHaveTextContent('null');

    // Act
    emit(channel, 7);

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('7');

    // Act
    await page.getByRole('button', { name: 'Clear' }).click();

    // Assert
    await expect.element(page.getByRole('status')).toHaveTextContent('null');
    expect(client.getQueryData(key)).toBeNull();
  });

  test('clears the request on the current query client after it changed', async () => {
    // Arrange
    const first = createTestQueryClient();
    const second = createTestQueryClient();
    second.setQueryData(key, 5);
    const screen = await render(under(first, <RequestProbe useRequestedId={useRequestedId} useClear={useClear} />));
    await screen.rerender(under(second, <RequestProbe useRequestedId={useRequestedId} useClear={useClear} />));

    // Act
    await page.getByRole('button', { name: 'Clear' }).click();

    // Assert
    expect(second.getQueryData(key)).toBeNull();
  });
});
