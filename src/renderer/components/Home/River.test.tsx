// Copyright (c) 2026 Théo Penavaire
// SPDX-License-Identifier: BUSL-1.1
// See LICENSE in the repository root for full terms.

import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createRootRoute, createRoute, createRouter, createMemoryHistory, RouterProvider } from '@tanstack/react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { SearchProvider } from '@/providers/search-provider';
import { RiverScopeProvider } from '@/providers/river-scope-provider';
import { ActiveWorkspaceIdProvider } from '@/providers/workspace-provider';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import { useIpcBridge } from '@/lib/ipc-bridge';
import { NotificationHost } from '@/lib/notifications';
import River from './River';
import { parseSearchQuery } from '../../../shared/search-query';
import { HOME_WORKSPACE_ID, type FeedSummary, type RefreshSummary, type RiverPage, type RiverQuery, type RiverRow, type SavedQuery, type SavedSearch, type SetSavedItemInput, type WorkspaceSummary } from '../../../shared/contracts';

let nextFeedId = 1;
let nextItemId = 1;
let nextPublishedAt = 1_000_000;

function createFeed(overrides: Partial<FeedSummary> = {}): FeedSummary {
  const id = overrides.id ?? nextFeedId++;
  return {
    id,
    link: `https://example.com/feed-${id}`,
    title: `Feed ${id}`,
    type: 'rss',
    showInWorkspace: 1,
    workspaceId: HOME_WORKSPACE_ID,
    last_fetched_at: undefined,
    last_error: undefined,
    icon: undefined,
    category: { id: 1, name: 'Tech', workspace_id: HOME_WORKSPACE_ID },
    itemCount: 0,
    unreadCount: 0,
    otherWorkspaceCount: 0,
    ...overrides,
  };
}

function createRow(feed: FeedSummary, overrides: Partial<RiverRow> = {}): RiverRow {
  const id = nextItemId++;
  return {
    id,
    title: `Item ${id}`,
    link: `https://example.com/item-${id}`,
    publishedAt: nextPublishedAt--,
    excerpt: `Item ${id} description`,
    feedTitle: feed.title,
    feedLink: feed.link,
    feedIcon: feed.icon,
    categoryName: feed.category.name,
    image: undefined,
    readAt: undefined,
    feedId: feed.id,
    type: feed.type,
    ...overrides,
  };
}

let allFeeds: FeedSummary[];
let allRows: RiverRow[];
let workspaces: WorkspaceSummary[];
let opmlImportResult: unknown;
let invokeMock: ReturnType<typeof vi.fn>;
let failSave: boolean;
let feedA: FeedSummary;
let feedsRefreshedHandler: ((payload: RefreshSummary) => void) | undefined;
let savedSearches: SavedSearch[];
let hintExample: string | undefined;
let nextSearchId: number;

function createWorkspace(overrides: Partial<WorkspaceSummary> = {}): WorkspaceSummary {
  return {
    id: HOME_WORKSPACE_ID,
    name: 'Home',
    icon: 'Home02',
    color: '#d67f48',
    position: 0,
    source_slug: undefined,
    source_version: undefined,
    installed_at: undefined,
    hasUnread: false,
    ...overrides,
  };
}

function computeRiverPage(query: RiverQuery): RiverPage {
  let candidates = allRows;

  candidates = query.feedIds
    ? candidates.filter((row) => new Set(query.feedIds).has(row.feedId))
    : candidates.filter((row) => allFeeds.find((feed) => feed.id === row.feedId)?.showInWorkspace !== 0);

  if (query.ids) {
    const idSet = new Set(query.ids);
    candidates = candidates.filter((row) => idSet.has(row.id));
  }
  if (query.unreadOnly) {
    candidates = candidates.filter((row) => !row.readAt);
  }

  const clauses = parseSearchQuery(query.search ?? '');
  candidates = candidates.filter((row) => clauses.every((clause) => {
    const hit = clause.alternatives.some((term) => (term.field === 'title' ? row.title : `${row.title} ${row.excerpt} ${row.feedTitle}`).toLowerCase().includes(term.text));
    return clause.negated ? !hit : hit;
  }));

  const sorted = [...candidates].sort((a, b) => b.publishedAt - a.publishedAt || b.id - a.id);
  const cursor = query.cursor;
  const afterCursor = cursor
    ? sorted.filter((row) => row.publishedAt < cursor.publishedAt || (row.publishedAt === cursor.publishedAt && row.id < cursor.id))
    : sorted;

  const page = afterCursor.slice(0, query.limit);
  const hasMore = afterCursor.length > query.limit;
  const last = page[page.length - 1];
  return { rows: page, ...(hasMore && last ? { nextCursor: { publishedAt: last.publishedAt, id: last.id } } : {}) };
}

beforeEach(() => {
  localStorage.clear();
  nextFeedId = 1;
  nextItemId = 1;
  nextPublishedAt = 1_000_000;
  allFeeds = [];
  allRows = [];
  workspaces = [];
  failSave = false;
  feedsRefreshedHandler = undefined;
  savedSearches = [];
  hintExample = undefined;
  nextSearchId = 1;
  opmlImportResult = { success: true, data: { workspaceId: HOME_WORKSPACE_ID, imported: 0, skipped: [], failed: [] } };

  invokeMock = vi.fn((channel: string, arg: unknown) => {
    switch (channel) {
      case 'feeds:list':
        return Promise.resolve(allFeeds.map((feed) => ({
          ...feed,
          unreadCount: allRows.filter((row) => row.feedId === feed.id && !row.readAt).length,
        })));
      case 'items:set-saved': {
        if (failSave) {
          return Promise.resolve({ success: false, error: { name: 'DB_ERROR', message: 'Write failed.' } });
        }
        const { itemId, saved } = arg as SetSavedItemInput;
        allRows = allRows.map((row) => row.id === itemId ? { ...row, savedAt: saved ? Date.now() : undefined } : row);
        return Promise.resolve({ success: true, data: undefined });
      }
      case 'saved:query': {
        const query = arg as SavedQuery;
        const rows = computeRiverPage({ workspaceId: query.workspaceId, limit: query.limit, ...(query.search ? { search: query.search } : {}) }).rows.filter((row) => row.savedAt != null)
          .sort((a, b) => (b.savedAt ?? 0) - (a.savedAt ?? 0) || b.id - a.id);
        return Promise.resolve({ rows });
      }
      case 'items:query':
        return Promise.resolve(computeRiverPage(arg as RiverQuery));
      case 'workspaces:list':
        return Promise.resolve(workspaces);
      case 'searches:list':
        return Promise.resolve({
          searches: savedSearches.map((search) => ({ ...search, unreadCount: computeRiverPage({ workspaceId: HOME_WORKSPACE_ID, limit: 1000, unreadOnly: true, search: search.query }).rows.length })),
          hintExample: savedSearches.length === 0 ? hintExample : undefined,
        });
      case 'searches:create': {
        const { name, query } = arg as { name: string; query: string };
        const created: SavedSearch = { id: nextSearchId++, workspace_id: HOME_WORKSPACE_ID, name, query, position: savedSearches.length, created_at: 1 };
        savedSearches = [...savedSearches, created];
        return Promise.resolve({ success: true, data: created });
      }
      case 'searches:update': {
        const { searchId, ...patch } = arg as { searchId: number; name?: string; query?: string };
        savedSearches = savedSearches.map((search) => (search.id === searchId ? { ...search, ...patch } : search));
        return Promise.resolve({ success: true, data: savedSearches.find((search) => search.id === searchId) });
      }
      case 'searches:delete':
        savedSearches = savedSearches.filter((search) => search.id !== (arg as { searchId: number }).searchId);
        return Promise.resolve({ success: true, data: undefined });
      case 'searches:dismiss-hint':
        hintExample = undefined;
        return Promise.resolve({ success: true, data: undefined });
      case 'opml:import':
        return Promise.resolve(opmlImportResult);
      case 'items:set-read': {
        const { itemIds, read } = arg as { itemIds: number[]; read: boolean };
        const targetIds = new Set(itemIds);
        allRows = allRows.map((row) => (targetIds.has(row.id) ? { ...row, readAt: read ? new Date().toISOString() : undefined } : row));
        return Promise.resolve({ success: true, data: undefined });
      }
      case 'feeds:set-show-in-workspace': {
        const { feedIds, showInWorkspace } = arg as { feedIds: number[]; showInWorkspace: boolean };
        const targetIds = new Set(feedIds);
        allFeeds = allFeeds.map((feed) => (targetIds.has(feed.id) ? { ...feed, showInWorkspace: showInWorkspace ? 1 : 0 } : feed));
        return Promise.resolve({ success: true, data: undefined });
      }
      default:
        return Promise.resolve([]);
    }
  });

  window.electron = {
    ipcRenderer: {
      invoke: invokeMock,
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'feeds:refreshed') {
          feedsRefreshedHandler = handler as typeof feedsRefreshedHandler;
        }
        return vi.fn();
      }),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;

  feedA = createFeed({ title: 'Feed A', link: 'https://a.example/feed' });
  const feedB = createFeed({ title: 'Feed B', link: 'https://b.example/feed' });
  allFeeds = [feedA, feedB];
  allRows = [
    createRow(feedA, { title: 'Item A1', excerpt: 'Item A1 description' }),
    createRow(feedA, { title: 'Item A2', excerpt: 'Item A2 description' }),
    createRow(feedB, { title: 'Item B1', excerpt: 'Item B1 description' }),
  ];
});

function IpcBridgeMount() {
  useIpcBridge();
  return null;
}

function Session({ children }: PropsWithChildren) {
  return <SearchProvider><IpcBridgeMount /><RiverScopeProvider><PreferencesProvider>{children}</PreferencesProvider></RiverScopeProvider></SearchProvider>;
}

test('saving from the list keeps the item unread and does not open it', async () => {
  // Arrange
  const onOpen = vi.fn();
  const { getByRole } = await renderWithQueryClient(<Session><River onOpenItem={onOpen} /></Session>);
  const save = getByRole('button', { name: 'Save', exact: true }).first();
  await expect.element(save).toBeVisible();
  invokeMock.mockClear();

  // Act
  save.element().focus();
  await userEvent.keyboard('{Enter}');

  // Assert
  await expect.element(getByRole('button', { name: 'Remove from Saved' })).toHaveAttribute('aria-pressed', 'true');
  expect(onOpen).not.toHaveBeenCalled();
  expect(invokeMock.mock.calls.some(([channel]) => channel === 'items:set-read' || channel === 'items:get-content')).toBe(false);
  expect(allRows[0]?.readAt).toBeUndefined();
});

test('restores the save control when the database write fails', async () => {
  // Arrange
  failSave = true;
  const { getByRole } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  const save = getByRole('button', { name: 'Save', exact: true }).first();

  // Act
  await save.click();

  // Assert
  await expect.element(save).toHaveAttribute('aria-pressed', 'false');
  await expect.poll(() => invokeMock.mock.calls.some(([channel]) => channel === 'items:set-saved')).toBe(true);
  expect(allRows.every((row) => row.savedAt === undefined)).toBe(true);
});

test('Saved shows read and unread items even when their source is removed', async () => {
  // Arrange
  allRows = allRows.map((row, index) => ({ ...row, savedAt: index + 1, readAt: index === 0 ? '2026-01-01' : undefined }));
  allFeeds = [];
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River savedView onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByRole('heading', { name: 'Saved', exact: true })).toBeVisible();
  await expect.element(getByText('Item A1', { exact: true })).toBeVisible();
  await expect.element(getByText('Item A2', { exact: true })).toBeVisible();
  expect(invokeMock.mock.calls.filter(([channel]) => channel === 'saved:query').map(([, arg]) => arg)).toEqual([{ workspaceId: HOME_WORKSPACE_ID, limit: 50 }]);
  await expect.element(getByRole('radiogroup', { name: 'Items to show' })).not.toBeInTheDocument();
});

test('Saved searches its own items and removes a save without opening it', async () => {
  // Arrange
  allRows = allRows.map((row) => ({ ...row, savedAt: row.id }));
  const onOpen = vi.fn();
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River savedView onOpenItem={onOpen} /></Session>);

  // Act
  await getByRole('textbox').fill('Item A1');
  await userEvent.keyboard('{Enter}');
  await expect.element(getByText('Item A2', { exact: true })).not.toBeInTheDocument();
  await getByRole('button', { name: 'Remove from Saved' }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
  expect(onOpen).not.toHaveBeenCalled();
});

test('an empty Saved list stays available without sources', async () => {
  // Arrange
  allFeeds = [];
  allRows = [];
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River savedView onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByText('Save items from your feeds to find them here.')).toBeVisible();
  await expect.element(getByRole('link', { name: 'Saved', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('shows items from every feed by default', async () => {
  // Arrange
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
});

test('rotating feed visibility narrows, widens, then narrows home again', async () => {
  // Arrange
  const { getByText, getByRole } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  await getByRole('button', { name: 'Tech', exact: true }).click();

  // Act: one click on Feed A shows only Feed A.
  await getByRole('button', { name: /^Feed A/ }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).not.toBeInTheDocument();

  // Act: focusing Feed B too shows both.
  await getByRole('button', { name: /^Feed B/ }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();

  // Act: clicking Feed A again drops it from the only set, leaving Feed B alone.
  await getByRole('button', { name: /^Feed A/ }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
});

test('hides feed items when showInWorkspace is set to 0', async () => {
  // Arrange
  const feedC = createFeed({ title: 'Feed C', link: 'https://c.example/feed', showInWorkspace: 0 });
  allFeeds = [...allFeeds, feedC];
  allRows = [...allRows, createRow(feedC, { title: 'Item C1', excerpt: 'Item C1 description' })];

  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByText('Item C1', { exact: true })).not.toBeInTheDocument();
});

test('clicking a card invokes onOpenItem with the item id', async () => {
  // Arrange
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
  const row = createRow(feed, { title: 'Clickable item' });
  allFeeds = [feed];
  allRows = [row];
  const onOpenItem = vi.fn();
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={onOpenItem} /></Session>);

  // Act
  await getByText('Clickable item', { exact: true }).click();

  // Assert
  expect(onOpenItem).toHaveBeenCalledWith(row.id);
});

describe('card keyboard interaction', () => {
  test('pressing Enter on a focused card opens it', async () => {
    // Arrange
    const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
    const row = createRow(feed, { title: 'Keyboard item' });
    allFeeds = [feed];
    allRows = [row];
    const onOpenItem = vi.fn();
    const { getByRole } = await renderWithQueryClient(<Session><River onOpenItem={onOpenItem} /></Session>);
    await expect.element(getByRole('button', { name: /Keyboard item/ })).toBeInTheDocument();
    getByRole('button', { name: /Keyboard item/ }).element().focus();

    // Act
    await userEvent.keyboard('{Enter}');

    // Assert
    expect(onOpenItem).toHaveBeenCalledWith(row.id);
  });

  test('pressing Space on a focused card opens it', async () => {
    // Arrange
    const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
    const row = createRow(feed, { title: 'Spacebar item' });
    allFeeds = [feed];
    allRows = [row];
    const onOpenItem = vi.fn();
    const { getByRole } = await renderWithQueryClient(<Session><River onOpenItem={onOpenItem} /></Session>);
    await expect.element(getByRole('button', { name: /Spacebar item/ })).toBeInTheDocument();
    getByRole('button', { name: /Spacebar item/ }).element().focus();

    // Act
    await userEvent.keyboard(' ');

    // Assert
    expect(onOpenItem).toHaveBeenCalledWith(row.id);
  });

  test('j and k move focus between cards', async () => {
    // Arrange: sorted newest first, so "First item" renders above "Second item".
    const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
    allFeeds = [feed];
    allRows = [
      createRow(feed, { title: 'First item', publishedAt: 2 }),
      createRow(feed, { title: 'Second item', publishedAt: 1 }),
    ];
    const { getByRole } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    const firstCard = getByRole('button', { name: /First item/ });
    const secondCard = getByRole('button', { name: /Second item/ });
    await expect.element(firstCard).toBeInTheDocument();

    // Act: j with nothing focused lands on the first card.
    await userEvent.keyboard('j');

    // Assert
    await expect.element(firstCard).toHaveFocus();

    // Act
    await userEvent.keyboard('j');

    // Assert
    await expect.element(secondCard).toHaveFocus();

    // Act
    await userEvent.keyboard('k');

    // Assert
    await expect.element(firstCard).toHaveFocus();
  });
});

test('hides read items when the hideReadItems preference is on', async () => {
  // Arrange
  localStorage.setItem('preferences-hide-read-items', JSON.stringify(true));
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
  allFeeds = [feed];
  allRows = [
    createRow(feed, { title: 'Read item', readAt: '2024-01-02T00:00:00.000Z' }),
    createRow(feed, { title: 'Unread item' }),
  ];

  // Act
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByText('Unread item', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Read item', { exact: true })).not.toBeInTheDocument();
});

test('the unread toggle hides read items and brings them back', async () => {
  // Arrange
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
  allFeeds = [feed];
  allRows = [
    createRow(feed, { title: 'Read item', readAt: '2024-01-02T00:00:00.000Z' }),
    createRow(feed, { title: 'Unread item' }),
  ];
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  await expect.element(getByText('Read item', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('radio', { name: 'Unread', exact: true }).click();

  // Assert
  await expect.element(getByText('Unread item', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Read item', { exact: true })).not.toBeInTheDocument();
  await expect.element(getByRole('radio', { name: 'Unread', exact: true })).toBeChecked();
  expect(localStorage.getItem('preferences-hide-read-items')).toBe('true');

  // Act
  await getByRole('radio', { name: 'All', exact: true }).click();

  // Assert
  await expect.element(getByRole('radio', { name: 'All', exact: true })).toBeChecked();
  await expect.element(getByText('Read item', { exact: true })).toBeInTheDocument();
  expect(localStorage.getItem('preferences-hide-read-items')).toBe('false');
});

test('shows a caught-up message when the unread filter leaves no items', async () => {
  // Arrange: every item is read, so filtering to unread empties the river.
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
  allFeeds = [feed];
  allRows = [createRow(feed, { title: 'Read item', readAt: '2024-01-02T00:00:00.000Z' })];
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Act
  await getByRole('radio', { name: 'Unread', exact: true }).click();

  // Assert
  await expect.element(getByText("You're all caught up", { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Read item', { exact: true })).not.toBeInTheDocument();
});

test('shows a caught-up message on the default path once nothing is unread', async () => {
  // Arrange: every item is read, hideReadItems stays off (the default).
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
  allFeeds = [feed];
  allRows = [createRow(feed, { title: 'Read item', readAt: '2024-01-02T00:00:00.000Z' })];

  // Act
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByText("You're all caught up", { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Read item', { exact: true })).not.toBeInTheDocument();
});

test('shows an onboarding empty state with zero feeds and opens the Add Feed modal', async () => {
  // Arrange
  allFeeds = [];
  allRows = [];
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Assert: no controls for a river that has nothing to search, filter or refresh.
  await expect.element(getByText('Pick your sources', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('textbox', { name: 'Search' })).not.toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Add a feed' })).not.toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Add your first feed' }).click();

  // Assert
  await expect.element(getByRole('heading', { name: 'Add a feed' })).toBeInTheDocument();
});

test('shows no empty state and queries no items while the feeds list is pending', async () => {
  // Arrange
  const realInvoke = invokeMock.getMockImplementation() as (channel: string, arg: unknown) => unknown;
  invokeMock.mockImplementation((channel: string, arg: unknown) => (channel === 'feeds:list' ? new Promise(() => undefined) : realInvoke(channel, arg)));

  // Act
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  await new Promise((resolve) => setTimeout(resolve, 100));

  // Assert
  await expect.element(getByText('Pick your sources', { exact: true })).not.toBeInTheDocument();
  expect(invokeMock.mock.calls.some(([channel]) => channel === 'items:query')).toBe(false);
});

test('an empty non-Home workspace can import OPML, and the summary survives the workspace no longer being empty', async () => {
  // Arrange: the workspace starts with no feeds, so River renders EmptyRiver's "Import OPML" CTA.
  // The import dialog itself must live above EmptyRiver, since a successful import makes the
  // workspace non-empty and would otherwise unmount EmptyRiver (and any dialog nested inside it)
  // before the user ever sees the result.
  allFeeds = [];
  allRows = [];
  workspaces = [createWorkspace(), createWorkspace({ id: 2, name: 'CI/CD watch' })];
  opmlImportResult = { success: true, data: { workspaceId: 2, imported: 1, skipped: [], failed: [] } };

  const rootRoute = createRootRoute({
    component: () => (
      <ActiveWorkspaceIdProvider>
        <Session><River onOpenItem={vi.fn()} /></Session>
      </ActiveWorkspaceIdProvider>
    ),
  });
  const workspaceRoute = createRoute({ getParentRoute: () => rootRoute, path: '/workspace/$workspaceId' });
  const router = createRouter({
    routeTree: rootRoute.addChildren([workspaceRoute]),
    history: createMemoryHistory({ initialEntries: ['/workspace/2'] }),
  });
  const { getByRole, queryClient } = await renderWithQueryClient(<RouterProvider router={router} />);

  // Act
  await getByRole('button', { name: 'Import OPML' }).click();
  await getByRole('button', { name: 'Import', exact: true }).click();
  await expect.element(getByRole('heading', { name: 'Import complete' })).toBeInTheDocument();

  // Act: simulate the feed list catching up with what the import just wrote, forcing the exact
  // hasFeeds transition that used to unmount EmptyRiver (and the dialog nested inside it).
  allFeeds = [createFeed({ title: 'Feed A', workspaceId: 2 })];
  await queryClient.invalidateQueries({ queryKey: ['feeds'] });

  // Assert: the summary is still visible once the workspace stops being empty.
  await expect.element(getByRole('heading', { name: 'Import complete' })).toBeInTheDocument();
});

test('opening a link externally sends link:open, marks it read, and does not navigate', async () => {
  // Arrange
  localStorage.setItem('preferences-open-links-externally', JSON.stringify(true));
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
  const row = createRow(feed, { title: 'External item', link: 'https://x.example/article' });
  allFeeds = [feed];
  allRows = [row];
  const onOpenItem = vi.fn();
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={onOpenItem} /></Session>);

  // Act
  await getByText('External item', { exact: true }).click();

  // Assert
  expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('link:open', row.link);
  await vi.waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith('items:set-read', { itemIds: [row.id], read: true });
  });
  expect(onOpenItem).not.toHaveBeenCalled();
});

test('density reads from preferences', async () => {
  // Arrange
  localStorage.setItem('preferences-density', JSON.stringify('Compact'));
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed' });
  allFeeds = [feed];
  allRows = [createRow(feed, { title: 'Compact item' })];

  // Act
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByText('Compact item', { exact: true })).toBeInTheDocument();
  const cardRoot = getByText('Compact item', { exact: true }).element().closest('[data-item-id]');
  expect(cardRoot?.tagName).toBe('DIV');
});

test('shows the YOUTUBE badge for an item from a youtube feed', async () => {
  // Arrange
  localStorage.setItem('preferences-density', JSON.stringify('Compact'));
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed', type: 'youtube' });
  allFeeds = [feed];
  allRows = [createRow(feed, { title: 'Video item' })];

  // Act
  const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

  // Assert
  await expect.element(getByText('Video item', { exact: true })).toBeInTheDocument();
  const cardRoot = getByText('Video item', { exact: true }).element().closest('[data-item-id]');
  expect(cardRoot?.textContent).toContain('YOUTUBE');
});

test('search filters river items by title', async () => {
  // Arrange
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  const search = getByRole('textbox', { name: 'Search' });

  // Act
  await search.fill('Item B1');

  // Assert
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).not.toBeInTheDocument();
});

test('search matches the feed name and surfaces that feed\'s items', async () => {
  // Arrange: "feed a" appears in no item title or description, only in the feed title.
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  const search = getByRole('textbox', { name: 'Search' });

  // Act
  await search.fill('feed a');

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).not.toBeInTheDocument();
});

test('search requires every word to match', async () => {
  // Arrange
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  const search = getByRole('textbox', { name: 'Search' });

  // Act
  await search.fill('item b1 description');

  // Assert
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
});

test('shows a no-results message and Escape restores every item', async () => {
  // Arrange
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  const search = getByRole('textbox', { name: 'Search' });

  // Act
  await search.fill('quantum');
  await expect.element(getByText('No results for "quantum"', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();

  // Act: Escape clears the query. fill() leaves the input focused.
  await userEvent.keyboard('{Escape}');

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('No results for "quantum"', { exact: true })).not.toBeInTheDocument();
});

test('cross button appears while typing and clears the query on click', async () => {
  // Arrange
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  const search = getByRole('textbox', { name: 'Search' });
  const cross = getByRole('button', { name: 'Clear search' });

  // Assert: nothing typed yet, so the cross is hidden.
  await expect.element(cross).not.toBeInTheDocument();

  // Act
  await search.fill('Item B1');

  // Assert
  await expect.element(cross).toBeInTheDocument();
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();

  // Act: click the cross.
  await cross.click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
  await expect.element(cross).not.toBeInTheDocument();
});

test('search query survives unmounting and remounting River', async () => {
  // Arrange: one SearchProvider instance outlives the River component.
  function Sessionable({ showRiver }: { showRiver: boolean }) {
    return (
      <SearchProvider>
        <RiverScopeProvider>
          <PreferencesProvider>
            {showRiver && <River onOpenItem={vi.fn()} />}
          </PreferencesProvider>
        </RiverScopeProvider>
      </SearchProvider>
    );
  }
  const screen = await renderWithQueryClient(<Sessionable showRiver />);
  const search = screen.getByRole('textbox', { name: 'Search' });
  await search.fill('Item B1');
  await expect.element(screen.getByText('Item B1', { exact: true })).toBeInTheDocument();

  // Act: leave the river, come back within the same session. `rerender` replaces the whole root,
  // so the QueryClientProvider from `renderWithQueryClient` has to be re-supplied here too.
  await screen.rerender(<QueryClientProvider client={screen.queryClient}><Sessionable showRiver={false} /></QueryClientProvider>);
  await screen.rerender(<QueryClientProvider client={screen.queryClient}><Sessionable showRiver /></QueryClientProvider>);

  // Assert
  await expect.element(screen.getByText('Item B1', { exact: true })).toBeInTheDocument();
  await expect.element(screen.getByText('Item A1', { exact: true })).not.toBeInTheDocument();
});

describe('refresh button', () => {
  test('new items in a visible feed turn the button into a Refresh pill that loads them without a fetch', async () => {
    // Arrange
    const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await expect.element(getByText('Item A1', { exact: true })).toBeVisible();
    allRows = [createRow(feedA, { title: 'Fresh A', publishedAt: 2_000_000 }), ...allRows];
    feedsRefreshedHandler?.({ perFeed: [{ feedId: feedA.id, inserted: 1 }] });
    const pill = getByRole('button', { name: 'Refresh, new articles available' });
    await expect.element(pill).toHaveTextContent('Refresh');
    await expect.element(getByText('Fresh A', { exact: true })).not.toBeInTheDocument();
    invokeMock.mockClear();

    // Act
    await pill.click();

    // Assert
    await expect.element(getByText('Fresh A', { exact: true })).toBeVisible();
    await expect.element(getByRole('button', { name: 'Refresh feeds' })).toBeVisible();
    expect(invokeMock.mock.calls.some(([channel]) => channel === 'feeds:refresh')).toBe(false);
  });

  test('new items only in a hidden feed keep the plain refresh button', async () => {
    // Arrange
    const feedC = createFeed({ title: 'Feed C', link: 'https://c.example/feed', showInWorkspace: 0 });
    allFeeds = [...allFeeds, feedC];
    const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await expect.element(getByText('Item A1', { exact: true })).toBeVisible();

    // Act
    feedsRefreshedHandler?.({ perFeed: [{ feedId: feedC.id, inserted: 2 }] });

    // Assert
    await expect.element(getByRole('button', { name: 'Refresh feeds' })).toBeVisible();
    await expect.element(getByRole('button', { name: 'Refresh, new articles available' })).not.toBeInTheDocument();
  });

  test('loading new items scrolls the river back to the top', async () => {
    // Arrange
    const { getByRole, getByText, container } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await expect.element(getByText('Item A1', { exact: true })).toBeVisible();
    const scroller = container.querySelector<HTMLElement>('.overflow-y-auto.pb-20');
    if (!scroller) {
      throw new Error('The river scroll container did not render.');
    }
    const scrollTo = vi.spyOn(scroller, 'scrollTo');
    feedsRefreshedHandler?.({ perFeed: [{ feedId: feedA.id, inserted: 1 }] });

    // Act
    await getByRole('button', { name: 'Refresh, new articles available' }).click();

    // Assert
    expect(scrollTo).toHaveBeenCalledWith({ top: 0 });
  });

  test('the Saved view never shows the Refresh pill', async () => {
    // Arrange
    allRows = allRows.map((row) => ({ ...row, savedAt: row.id }));
    const { getByRole, getByText } = await renderWithQueryClient(<Session><River savedView onOpenItem={vi.fn()} /></Session>);
    await expect.element(getByText('Item A1', { exact: true })).toBeVisible();

    // Act
    feedsRefreshedHandler?.({ perFeed: [{ feedId: feedA.id, inserted: 1 }] });

    // Assert
    await expect.element(getByRole('button', { name: 'Refresh, new articles available' })).not.toBeInTheDocument();
  });
});

function addSearch(name: string, query: string): void {
  savedSearches = [...savedSearches, { id: nextSearchId++, workspace_id: HOME_WORKSPACE_ID, name, query, position: savedSearches.length, created_at: 1 }];
}

describe('saved search pills', () => {
  test('shows each pill with its unread count and no row without a saved search', async () => {
    // Arrange
    addSearch('A items', 'title:"item a"');
    allRows = allRows.map((row) => (row.title === 'Item A2' ? { ...row, readAt: '2026-01-01' } : row));

    // Act
    const { getByRole } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

    // Assert
    await expect.element(getByRole('button', { name: 'A items, 1 unread' })).toHaveAttribute('aria-pressed', 'false');
    await expect.element(getByRole('toolbar', { name: 'Saved searches' })).toBeVisible();
  });

  test('selecting a pill runs its search, selecting it again clears it', async () => {
    // Arrange
    addSearch('B items', 'title:"item b"');
    const { getByRole, getByText, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    const pill = getByRole('button', { name: 'B items, 1 unread' });

    // Act
    await pill.click();

    // Assert
    await expect.element(pill).toHaveAttribute('aria-pressed', 'true');
    await expect.element(getByPlaceholder('Search')).toHaveValue('title:"item b"');
    await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
    await expect.element(getByText('Item B1', { exact: true })).toBeVisible();

    // Act
    await pill.click();

    // Assert
    await expect.element(pill).toHaveAttribute('aria-pressed', 'false');
    await expect.element(getByPlaceholder('Search')).toHaveValue('');
    await expect.element(getByText('Item A1', { exact: true })).toBeVisible();
  });

  test('selecting a pill turns unread only off, so read matches stay visible', async () => {
    // Arrange
    localStorage.setItem('preferences-hide-read-items', JSON.stringify(true));
    addSearch('B items', 'title:"item b"');
    allRows = allRows.map((row) => (row.title === 'Item B1' ? { ...row, readAt: '2026-01-01' } : row));
    const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

    // Act
    await getByRole('button', { name: 'B items, 0 unread' }).click();

    // Assert
    await expect.element(getByText('Item B1', { exact: true })).toBeVisible();
    await expect.element(getByRole('radio', { name: 'All' })).toBeChecked();
    expect(localStorage.getItem('preferences-hide-read-items')).toBe('false');
  });

  test('saves the typed search under a name and selects the new pill', async () => {
    // Arrange
    const { getByRole, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await getByPlaceholder('Search').fill('item b -"item a"');

    // Act
    await getByRole('button', { name: 'Save search' }).click();
    const name = getByRole('textbox', { name: 'Name of the saved search' });
    await expect.element(name).toHaveValue('item b -"item a"');
    await name.fill('Bs');
    await getByRole('dialog', { name: 'Name this search' }).getByRole('button', { name: 'Save', exact: true }).click();

    // Assert
    await expect.element(getByRole('button', { name: 'Bs, 1 unread' })).toHaveAttribute('aria-pressed', 'true');
    expect(invokeMock).toHaveBeenCalledWith('searches:create', { workspaceId: HOME_WORKSPACE_ID, name: 'Bs', query: 'item b -"item a"' });
    await expect.element(getByRole('button', { name: 'Save search' })).not.toBeInTheDocument();
  });

  test('offers Update and Save as new once a selected pill query is edited', async () => {
    // Arrange
    addSearch('B items', 'item b');
    const { getByRole, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await getByRole('button', { name: 'B items, 1 unread' }).click();
    await expect.element(getByRole('button', { name: 'Update' })).not.toBeInTheDocument();

    // Act
    await getByPlaceholder('Search').fill('item');
    await getByRole('button', { name: 'Update' }).click();

    // Assert
    await expect.poll(() => invokeMock.mock.calls.some(([channel, arg]) => channel === 'searches:update' && (arg as { query?: string }).query === 'item')).toBe(true);

    // Act
    await getByPlaceholder('Search').fill('item a');
    await getByRole('button', { name: 'Save as new' }).click();
    await getByRole('textbox', { name: 'Name of the saved search' }).fill('As');
    await getByRole('dialog', { name: 'Name this search' }).getByRole('button', { name: 'Save', exact: true }).click();

    // Assert
    await expect.element(getByRole('button', { name: 'As, 2 unread' })).toBeVisible();
  });

  test('shows the error when a name is already taken', async () => {
    // Arrange
    addSearch('Bs', 'item b');
    const duplicate = { success: false, error: { name: 'DUPLICATE_NAME', message: 'A saved search named "Bs" already exists.' } };
    const original = invokeMock.getMockImplementation() as (channel: string, arg: unknown) => Promise<unknown>;
    invokeMock.mockImplementation((channel: string, arg: unknown) => (channel === 'searches:create' ? Promise.resolve(duplicate) : original(channel, arg)));
    const { getByRole, getByText, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await getByPlaceholder('Search').fill('item a');

    // Act
    await getByRole('button', { name: 'Save search' }).click();
    await getByRole('textbox', { name: 'Name of the saved search' }).fill('Bs');
    await getByRole('dialog', { name: 'Name this search' }).getByRole('button', { name: 'Save', exact: true }).click();

    // Assert
    await expect.element(getByText('A saved search named "Bs" already exists.')).toBeVisible();
  });

  test('deletes a pill from its cross and brings it back with Undo', async () => {
    // Arrange
    addSearch('B items', 'item b');
    const { getByRole } = await renderWithQueryClient(<Session><NotificationHost /><River onOpenItem={vi.fn()} /></Session>);
    await expect.element(getByRole('button', { name: 'B items, 1 unread' })).toBeVisible();

    // Act
    await getByRole('button', { name: 'Delete saved search B items' }).click({ force: true });

    // Assert
    await expect.element(getByRole('button', { name: 'B items, 1 unread' })).not.toBeInTheDocument();

    // Act
    await getByRole('button', { name: 'Undo' }).click();

    // Assert
    await expect.element(getByRole('button', { name: 'B items, 1 unread' })).toBeVisible();
    expect(invokeMock).toHaveBeenCalledWith('searches:create', { workspaceId: HOME_WORKSPACE_ID, name: 'B items', query: 'item b' });
  });

  test('renames a pill from the keyboard', async () => {
    // Arrange
    addSearch('B items', 'item b');
    const { getByRole } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await expect.element(getByRole('button', { name: 'B items, 1 unread' })).toBeVisible();
    getByRole('button', { name: 'B items, 1 unread' }).element().focus();

    // Act
    await userEvent.keyboard('{F2}');
    await getByRole('textbox', { name: 'Rename saved search B items' }).fill('Bs');
    await userEvent.keyboard('{Enter}');

    // Assert
    await expect.element(getByRole('button', { name: 'Bs, 1 unread' })).toBeVisible();
    expect(invokeMock).toHaveBeenCalledWith('searches:update', { searchId: 1, name: 'Bs' });
  });

  test('lists every pill in the overflow menu and selects from it', async () => {
    // Arrange
    addSearch('A items', 'item a');
    addSearch('B items', 'item b');
    const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

    // Act
    await getByRole('button', { name: 'All saved searches' }).click();
    await getByRole('menuitem', { name: /B items/ }).click();

    // Assert
    await expect.element(getByRole('button', { name: 'B items, 1 unread' })).toHaveAttribute('aria-pressed', 'true');
    await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
  });

  test('shows the hint pill only when the main process offers an example, fills the search from it and dismisses it', async () => {
    // Arrange
    hintExample = 'title:engineer -manager';
    const { getByRole, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    const hint = getByRole('button', { name: /Save a search for each role you want/ });
    await expect.element(hint).toBeVisible();

    // Act
    await hint.click();

    // Assert
    await expect.element(getByPlaceholder('Search')).toHaveValue('title:engineer -manager');

    // Act
    await getByRole('button', { name: 'Dismiss the saved search hint' }).click();

    // Assert
    await expect.element(hint).not.toBeInTheDocument();
    expect(invokeMock).toHaveBeenCalledWith('searches:dismiss-hint', { workspaceId: HOME_WORKSPACE_ID });
  });

  test('shows no hint and no row by default', async () => {
    // Arrange
    const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await expect.element(getByText('Item A1', { exact: true })).toBeVisible();

    // Assert
    await expect.element(getByRole('toolbar', { name: 'Saved searches' })).not.toBeInTheDocument();
  });

  test('lists the search syntax in the help popover', async () => {
    // Arrange
    const { getByText, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

    // Act
    await getByPlaceholder('Search').click();

    // Assert
    await expect.element(getByText('title:release')).toBeVisible();
    await expect.element(getByText('kubernetes OR k8s')).toBeVisible();
  });
});

describe('job cards', () => {
  test('show the company, place, work mode and salary of a job, or that the salary is not shown', async () => {
    // Arrange
    const jobFeed = createFeed({ title: 'Acme · Jobs', link: 'https://api.lever.co/v0/postings/acme?mode=json', type: 'ats' });
    allFeeds = [jobFeed];
    allRows = [
      createRow(jobFeed, { title: 'Backend Engineer', job: { company: 'Acme', location: 'Paris', workMode: 'remote', salaryLabel: '€60k–€75k', } }),
      createRow(jobFeed, { title: 'Designer', job: { company: 'Acme', location: undefined, workMode: undefined, salaryLabel: undefined } }),
    ];

    // Act
    const { getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);

    // Assert
    await expect.element(getByText('Acme · Paris')).toBeVisible();
    await expect.element(getByText('Remote', { exact: true })).toBeVisible();
    await expect.element(getByText('€60k–€75k')).toBeVisible();
    await expect.element(getByText('salary not shown')).toBeVisible();
    await expect.element(getByText('Acme', { exact: true })).toBeVisible();
  });
});

describe('search box', () => {
  test('opens the syntax help on focus and closes it on Enter, keeping the filter', async () => {
    // Arrange
    const { getByRole, getByText, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    const box = getByPlaceholder('Search');
    await expect.element(getByText('title:release')).not.toBeInTheDocument();

    // Act
    await box.click();

    // Assert
    await expect.element(getByRole('region', { name: 'Search syntax' })).toBeVisible();

    // Act
    await box.fill('item b');
    await userEvent.keyboard('{Enter}');

    // Assert
    await expect.element(getByRole('region', { name: 'Search syntax' })).not.toBeInTheDocument();
    await expect.element(box).toHaveValue('item b');
  });

  test('stays open while the save popover is used, and closes on a press outside', async () => {
    // Arrange
    const { getByRole, getByTestId, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
    await getByPlaceholder('Search').fill('item b');

    // Act
    await getByRole('button', { name: 'Save search' }).click();

    // Assert
    await expect.element(getByRole('dialog', { name: 'Name this search' })).toBeVisible();
    await expect.element(getByRole('region', { name: 'Search syntax' })).toBeVisible();

    // Act
    await userEvent.keyboard('{Escape}');
    await expect.element(getByRole('region', { name: 'Search syntax' })).toBeVisible();
    (getByTestId('search-scrim').element() as HTMLElement).click();

    // Assert
    await expect.element(getByRole('region', { name: 'Search syntax' })).not.toBeInTheDocument();
  });

  test('a click outside closes the search without opening the item under it', async () => {
    // Arrange
    const onOpen = vi.fn();
    const { getByRole, getByTestId, getByPlaceholder } = await renderWithQueryClient(<Session><River onOpenItem={onOpen} /></Session>);
    await getByPlaceholder('Search').click();
    await expect.element(getByRole('region', { name: 'Search syntax' })).toBeVisible();

    // Act
    (getByTestId('search-scrim').element() as HTMLElement).click();

    // Assert
    await expect.element(getByRole('region', { name: 'Search syntax' })).not.toBeInTheDocument();
    expect(onOpen).not.toHaveBeenCalled();
  });
});
