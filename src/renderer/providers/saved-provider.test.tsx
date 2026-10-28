// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import { QueryClient } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { useSavedState } from './saved-provider';
import { NotificationHost } from '../lib/notifications';
import { queryKeys } from '../lib/queries';
import { renderWithQueryClient } from '../lib/test/render-with-query-client';
import { HOME_WORKSPACE_ID, type RiverRow } from '../../shared/contracts';

const OTHER_WORKSPACE_ID = 2;

function createRow(id: number, savedAt?: number): RiverRow {
  return {
    id,
    title: `Item ${id}`,
    link: `https://example.com/item-${id}`,
    publishedAt: id,
    excerpt: '',
    image: undefined,
    readAt: undefined,
    savedAt,
    feedId: 1,
    feedTitle: 'Feed A',
    feedLink: 'https://example.com/feed',
    feedIcon: undefined,
    categoryName: 'Tech',
    type: 'rss',
  };
}

let invokeImpl: (channel: string, arg: unknown) => Promise<unknown>;

beforeEach(() => {
  invokeImpl = () => Promise.resolve({ success: true, data: undefined });
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn((channel: string, arg: unknown) => invokeImpl(channel, arg)),
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

function SavedButtons({ itemId, onSuccess }: { itemId: number; onSuccess?: () => void }) {
  const { setSaved, isPending } = useSavedState();
  return (
    <div>
      <button type="button" onClick={() => setSaved(itemId, true, onSuccess)}>Save</button>
      <button type="button" onClick={() => setSaved(itemId, false, onSuccess)}>Unsave</button>
      <span>{isPending ? 'pending' : 'idle'}</span>
    </div>
  );
}

function seedRiver(queryClient: QueryClient, key: ReturnType<typeof queryKeys.river>, rows: RiverRow[]): void {
  queryClient.setQueryData(key, { pages: [{ rows }], pageParams: [undefined] });
}

function savedAtOf(queryClient: QueryClient, key: ReturnType<typeof queryKeys.river>): (number | undefined)[] {
  return queryClient.getQueryData<{ pages: { rows: RiverRow[] }[] }>(key)?.pages.flatMap((page) => page.rows.map((row) => row.savedAt)) ?? [];
}

function renderSavedButtons(props: { itemId: number; onSuccess?: () => void }) {
  // The default gc time keeps the seeded rivers in the cache while no component observes them.
  return renderWithQueryClient(<><SavedButtons {...props} /><NotificationHost /></>, new QueryClient({ defaultOptions: { mutations: { retry: false } } }));
}

describe('useSavedState', () => {
  test('saving an item sends the request for the active workspace and stamps the item in every river of that workspace', async () => {
    // Arrange
    const homeKey = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID });
    const searchKey = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID, search: 'rust' });
    const otherKey = queryKeys.river({ workspaceId: OTHER_WORKSPACE_ID });
    const { getByRole, queryClient } = await renderSavedButtons({ itemId: 5 });
    seedRiver(queryClient, homeKey, [createRow(4), createRow(5)]);
    seedRiver(queryClient, searchKey, [createRow(5)]);
    seedRiver(queryClient, otherKey, [createRow(5)]);
    queryClient.getQueryCache().build(queryClient, { queryKey: queryKeys.river({ workspaceId: HOME_WORKSPACE_ID, unreadOnly: true }) });
    const before = Date.now();

    // Act
    await getByRole('button', { name: 'Save' }).click();

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('items:set-saved', { workspaceId: HOME_WORKSPACE_ID, itemId: 5, saved: true });
    const [untouched, stamped] = savedAtOf(queryClient, homeKey);
    expect(untouched).toBeUndefined();
    expect(stamped).toBeGreaterThanOrEqual(before);
    expect(savedAtOf(queryClient, searchKey)[0]).toBeGreaterThanOrEqual(before);
    expect(savedAtOf(queryClient, otherKey)).toEqual([undefined]);
  });

  test('saving an already saved item keeps its save time', async () => {
    // Arrange
    const key = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID });
    const { getByRole, queryClient } = await renderSavedButtons({ itemId: 5 });
    seedRiver(queryClient, key, [createRow(5, 1234)]);

    // Act
    await getByRole('button', { name: 'Save' }).click();

    // Assert
    expect(savedAtOf(queryClient, key)).toEqual([1234]);
  });

  test('removing an item from Saved clears its save time', async () => {
    // Arrange
    const key = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID, saved: true });
    const { getByRole, queryClient } = await renderSavedButtons({ itemId: 5 });
    seedRiver(queryClient, key, [createRow(5, 1234), createRow(6, 99)]);

    // Act
    await getByRole('button', { name: 'Unsave' }).click();

    // Assert
    expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('items:set-saved', { workspaceId: HOME_WORKSPACE_ID, itemId: 5, saved: false });
    expect(savedAtOf(queryClient, key)).toEqual([undefined, 99]);
  });

  test('a successful write refreshes the rivers and runs the success callback', async () => {
    // Arrange
    const key = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID });
    const onSuccess = vi.fn();
    const { getByRole, getByText, queryClient } = await renderSavedButtons({ itemId: 5, onSuccess });
    seedRiver(queryClient, key, [createRow(5)]);
    queryClient.setQueryData(queryKeys.feeds(HOME_WORKSPACE_ID), []);

    // Act
    await getByRole('button', { name: 'Save' }).click();

    // Assert
    await vi.waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
    await vi.waitFor(() => {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
    expect(queryClient.getQueryState(queryKeys.feeds(HOME_WORKSPACE_ID))?.isInvalidated).toBe(false);
    await expect.element(getByText('idle', { exact: true })).toBeInTheDocument();
  });

  test('saving works without a success callback', async () => {
    // Arrange
    const key = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID });
    const { getByRole, queryClient } = await renderSavedButtons({ itemId: 5 });
    seedRiver(queryClient, key, [createRow(5)]);

    // Act
    await getByRole('button', { name: 'Save' }).click();

    // Assert
    await vi.waitFor(() => {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
  });

  test('a refused save restores the item, says so and skips the success callback', async () => {
    // Arrange
    invokeImpl = () => Promise.resolve({ success: false, error: { name: 'ITEM_NOT_FOUND', message: 'gone' } });
    const key = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID });
    const onSuccess = vi.fn();
    const { getByRole, getByText, queryClient } = await renderSavedButtons({ itemId: 5, onSuccess });
    seedRiver(queryClient, key, [createRow(4, 40), createRow(5)]);

    // Act
    await getByRole('button', { name: 'Save' }).click();

    // Assert
    await expect.element(getByText('The item could not be saved. Try again.', { exact: true })).toBeInTheDocument();
    expect(savedAtOf(queryClient, key)).toEqual([40, undefined]);
    expect(onSuccess).not.toHaveBeenCalled();
    await vi.waitFor(() => {
      expect(queryClient.getQueryState(key)?.isInvalidated).toBe(true);
    });
  });

  test('a refused removal restores the save time and says so', async () => {
    // Arrange
    invokeImpl = () => Promise.reject(new Error('offline'));
    const key = queryKeys.river({ workspaceId: HOME_WORKSPACE_ID, saved: true });
    const { getByRole, getByText, queryClient } = await renderSavedButtons({ itemId: 5 });
    seedRiver(queryClient, key, [createRow(5, 1234)]);

    // Act
    await getByRole('button', { name: 'Unsave' }).click();

    // Assert
    await expect.element(getByText('The item could not be removed from Saved. Try again.', { exact: true })).toBeInTheDocument();
    expect(savedAtOf(queryClient, key)).toEqual([1234]);
  });
});
