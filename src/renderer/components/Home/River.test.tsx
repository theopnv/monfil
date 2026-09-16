import type { PropsWithChildren } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { SearchProvider } from '@/providers/search-provider';
import { RiverScopeProvider } from '@/providers/river-scope-provider';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import River from './River';
import { HOME_WORKSPACE_ID, type FeedSummary, type RiverPage, type RiverQuery, type RiverRow } from '../../../preload/channels';

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
let invokeMock: ReturnType<typeof vi.fn>;

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

  const words = query.search?.trim().toLowerCase().split(/\s+/).filter(Boolean) ?? [];
  candidates = candidates.filter((row) => words.every((word) =>
    row.title.toLowerCase().includes(word) || row.excerpt.toLowerCase().includes(word) || row.feedTitle.toLowerCase().includes(word),
  ));

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

  invokeMock = vi.fn((channel: string, arg: unknown) => {
    switch (channel) {
      case 'feeds:list':
        return Promise.resolve(allFeeds.map((feed) => ({
          ...feed,
          unreadCount: allRows.filter((row) => row.feedId === feed.id && !row.readAt).length,
        })));
      case 'items:query':
        return Promise.resolve(computeRiverPage(arg as RiverQuery));
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
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;

  const feedA = createFeed({ title: 'Feed A', link: 'https://a.example/feed' });
  const feedB = createFeed({ title: 'Feed B', link: 'https://b.example/feed' });
  allFeeds = [feedA, feedB];
  allRows = [
    createRow(feedA, { title: 'Item A1', excerpt: 'Item A1 description' }),
    createRow(feedA, { title: 'Item A2', excerpt: 'Item A2 description' }),
    createRow(feedB, { title: 'Item B1', excerpt: 'Item B1 description' }),
  ];
});

function Session({ children }: PropsWithChildren) {
  return <SearchProvider><RiverScopeProvider><PreferencesProvider>{children}</PreferencesProvider></RiverScopeProvider></SearchProvider>;
}

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
  await getByRole('button', { name: 'Show Unread' }).click();

  // Assert
  await expect.element(getByText('Unread item', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Read item', { exact: true })).not.toBeInTheDocument();
  expect(localStorage.getItem('preferences-hide-read-items')).toBe('true');

  // Act
  await getByRole('button', { name: 'Show All' }).click();

  // Assert
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
  await getByRole('button', { name: 'Show Unread' }).click();

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
  await expect.element(getByRole('textbox', { name: 'Search everything' })).not.toBeInTheDocument();
  await expect.element(getByRole('heading', { name: 'Add a feed' })).not.toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Add your first feed' }).click();

  // Assert
  await expect.element(getByRole('heading', { name: 'Add a feed' })).toBeInTheDocument();
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
  const search = getByRole('textbox', { name: 'Search everything' });

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
  const search = getByRole('textbox', { name: 'Search everything' });

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
  const search = getByRole('textbox', { name: 'Search everything' });

  // Act
  await search.fill('item b1 description');

  // Assert
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
});

test('shows a no-results message and Escape restores every item', async () => {
  // Arrange
  const { getByRole, getByText } = await renderWithQueryClient(<Session><River onOpenItem={vi.fn()} /></Session>);
  const search = getByRole('textbox', { name: 'Search everything' });

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
  const search = getByRole('textbox', { name: 'Search everything' });
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
  const search = screen.getByRole('textbox', { name: 'Search everything' });
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
