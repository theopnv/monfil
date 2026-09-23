import type { PropsWithChildren } from 'react';
import { beforeEach, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { PreferencesProvider } from '@/providers/preferences-provider';
import { SearchProvider } from '@/providers/search-provider';
import { RiverScopeProvider } from '@/providers/river-scope-provider';
import { useIpcBridge } from '@/lib/ipc-bridge';
import { renderWithQueryClient } from '@/lib/test/render-with-query-client';
import Reader from './Reader';
import type { ReaderProps } from './Reader';
import { HOME_WORKSPACE_ID, type FeedCategory, type FeedSummary, type ItemBody, type RiverPage, type RiverQuery, type RiverRow } from '../../../shared/contracts';

let nextFeedId = 1;
let nextItemId = 1;

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

let descriptionsById: Map<number, string>;

function createRow(feed: FeedSummary, overrides: Partial<RiverRow> & { description?: string } = {}): RiverRow {
  const id = nextItemId++;
  const { description, ...rowOverrides } = overrides;
  descriptionsById.set(id, description ?? `<p>Item ${id} description</p>`);
  return {
    id,
    title: `Item ${id}`,
    link: `https://example.com/item-${id}`,
    publishedAt: id,
    excerpt: `Item ${id} description`,
    feedTitle: feed.title,
    feedLink: feed.link,
    feedIcon: feed.icon,
    categoryName: feed.category.name,
    image: undefined,
    readAt: undefined,
    feedId: feed.id,
    type: feed.type,
    ...rowOverrides,
  };
}

let allFeeds: FeedSummary[];
let allRows: RiverRow[];
let itemBodyOverride: ItemBody | undefined | 'pending';

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

// Ordered newest to oldest. itemA is in its own feed so navigation tests exercise the full flat river order.
function setUpThreeItemRiver() {
  const feedA = createFeed({ title: 'Feed A', link: 'https://a.example/feed' });
  const feedB = createFeed({ title: 'Feed B', link: 'https://b.example/feed' });
  const itemA = createRow(feedA, { title: 'Newest item', publishedAt: 3 });
  const itemB = createRow(feedB, { title: 'Middle item', publishedAt: 2 });
  const itemC = createRow(feedB, { title: 'Oldest item', publishedAt: 1 });
  allFeeds = [feedA, feedB];
  allRows = [itemA, itemB, itemC];
  return { itemA, itemB, itemC, feedA };
}

function Session({ children }: PropsWithChildren) {
  return (
    <SearchProvider>
      <RiverScopeProvider>
        <PreferencesProvider>
          <IpcBridgeMount />
          {children}
        </PreferencesProvider>
      </RiverScopeProvider>
    </SearchProvider>
  );
}

function IpcBridgeMount() {
  useIpcBridge();
  return null;
}

function renderReader(props: ReaderProps) {
  return renderWithQueryClient(<Session><Reader {...props} /></Session>);
}

let invokeMock: ReturnType<typeof vi.fn>;
let renameCategoryRequestedHandler: ((categoryId: number) => void) | undefined;

beforeEach(() => {
  localStorage.clear();
  nextFeedId = 1;
  nextItemId = 1;
  allFeeds = [];
  allRows = [];
  descriptionsById = new Map();
  itemBodyOverride = undefined;
  renameCategoryRequestedHandler = undefined;

  invokeMock = vi.fn((channel: string, arg: unknown) => {
    switch (channel) {
      case 'feeds:list':
        return Promise.resolve(allFeeds);
      case 'feeds:list-categories': {
        const categories = new Map<number, FeedCategory>();
        allFeeds.forEach((feed) => categories.set(feed.category.id, feed.category));
        return Promise.resolve([...categories.values()]);
      }
      case 'items:query':
        return Promise.resolve(computeRiverPage(arg as RiverQuery));
      case 'items:get-content': {
        if (itemBodyOverride === 'pending') {
          return new Promise(() => { });
        }
        if (itemBodyOverride) {
          return Promise.resolve(itemBodyOverride);
        }
        const itemId = arg as number;
        return Promise.resolve({ description: descriptionsById.get(itemId) ?? '', article: undefined } satisfies ItemBody);
      }
      case 'items:set-read':
        return Promise.resolve({ success: true, data: undefined });
      default:
        return Promise.resolve([]);
    }
  });

  window.electron = {
    ipcRenderer: {
      invoke: invokeMock,
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'feeds:rename-category-requested') {
          renameCategoryRequestedHandler = handler as (categoryId: number) => void;
        }
        return vi.fn();
      }),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

test('renders the matched item title, byline and body', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();

  // Act
  const { getByText, getByTestId } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Feed B', { exact: true })).toBeInTheDocument();
  await expect.element(getByTestId('article-body').getByText(`Item ${itemB.id} description`, { exact: true })).toBeInTheDocument();
});

test('shows a not-found fallback with a way back home for an unknown id', async () => {
  // Arrange
  setUpThreeItemRiver();
  const onNavigateHome = vi.fn();

  // Act
  const { getByText, getByRole } = await renderReader({ itemId: "999999", onNavigateToItem: vi.fn(), onNavigateHome });

  // Assert
  await expect.element(getByText('This article could not be found.', { exact: true })).toBeInTheDocument();
  await getByRole('button', { name: 'Back to Home' }).click();
  expect(onNavigateHome).toHaveBeenCalled();
});

test('marks the current item read on mount', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();

  // Act
  await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await vi.waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith('items:set-read', { itemIds: [itemB.id], read: true });
  });
});

test('mark unread calls toggleRead, flipping the current item back to unread', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();

  // Act
  const { getByRole, getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();
  invokeMock.mockClear();
  await getByRole('button', { name: 'Mark unread' }).click();

  // Assert: mounting already marked it read, so toggling now must set it back to unread.
  await vi.waitFor(() => {
    expect(invokeMock).toHaveBeenCalledWith('items:set-read', { itemIds: [itemB.id], read: false });
  });
});

test('pressing Escape leaves the Reader', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();
  const onNavigateHome = vi.fn();
  const { getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome });
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();

  // Act
  await userEvent.keyboard('{Escape}');

  // Assert
  expect(onNavigateHome).toHaveBeenCalled();
});

test('pressing j and k navigates to the next and previous neighbor', async () => {
  // Arrange
  const { itemA, itemB, itemC } = setUpThreeItemRiver();
  const onNavigateToItem = vi.fn();
  const { getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem, onNavigateHome: vi.fn() });
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();

  // Act
  await userEvent.keyboard('j');

  // Assert
  expect(onNavigateToItem).toHaveBeenCalledWith(itemC.id);

  // Act
  await userEvent.keyboard('k');

  // Assert
  expect(onNavigateToItem).toHaveBeenCalledWith(itemA.id);
});

test('Reader shortcuts ignore modifier keys', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();
  const onNavigateToItem = vi.fn();
  const onNavigateHome = vi.fn();
  const { getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem, onNavigateHome });
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();

  // Act
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'j', ctrlKey: true, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', altKey: true, bubbles: true }));
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', shiftKey: true, bubbles: true }));

  // Assert
  expect(onNavigateHome).not.toHaveBeenCalled();
  expect(onNavigateToItem).not.toHaveBeenCalled();
});

test('typing in the category rename field does not trigger Reader shortcuts', async () => {
  // Arrange
  const { itemB, feedA } = setUpThreeItemRiver();
  const onNavigateToItem = vi.fn();
  const onNavigateHome = vi.fn();
  const { getByRole, getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem, onNavigateHome });
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();
  await expect.element(getByRole('button', { name: 'Tech', exact: true })).toBeInTheDocument();
  await vi.waitFor(() => expect(renameCategoryRequestedHandler).toBeDefined());

  // Act
  renameCategoryRequestedHandler?.(feedA.category.id);
  const renameInput = getByRole('textbox', { name: 'Rename Tech' });
  await expect.element(renameInput).toHaveValue('Tech');
  await userEvent.clear(renameInput);
  await userEvent.type(renameInput, 'junk');

  // Assert
  expect(onNavigateToItem).not.toHaveBeenCalled();
  await userEvent.keyboard('{Escape}');
  expect(onNavigateHome).not.toHaveBeenCalled();
});

test('disabling the keyboard navigation preference turns off Escape, j and k', async () => {
  // Arrange
  localStorage.setItem('preferences-keyboard-navigation', JSON.stringify(false));
  const { itemB } = setUpThreeItemRiver();
  const onNavigateHome = vi.fn();
  const onNavigateToItem = vi.fn();
  const { getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem, onNavigateHome });
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();

  // Act
  await userEvent.keyboard('{Escape}jk');

  // Assert
  expect(onNavigateHome).not.toHaveBeenCalled();
  expect(onNavigateToItem).not.toHaveBeenCalled();
});

test('shows the keyboard shortcuts hint by default', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();

  // Act
  const { getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByText('back to Home', { exact: true })).toBeInTheDocument();
});

test('hides the keyboard shortcuts hint when the preference is off', async () => {
  // Arrange
  localStorage.setItem('preferences-keyboard-navigation', JSON.stringify(false));
  const { itemB } = setUpThreeItemRiver();

  // Act
  const { getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByText('back to Home', { exact: true })).not.toBeInTheDocument();
});

test('previous is disabled on the newest item', async () => {
  // Arrange
  const { itemA } = setUpThreeItemRiver();

  // Act
  const { getByRole } = await renderReader({ itemId: String(itemA.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByRole('button', { name: 'Previous article' })).toBeDisabled();
  await expect.element(getByRole('button', { name: 'Next article' })).toBeEnabled();
});

test('next is disabled on the oldest item', async () => {
  // Arrange
  const { itemC } = setUpThreeItemRiver();

  // Act
  const { getByRole } = await renderReader({ itemId: String(itemC.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByRole('button', { name: 'Next article' })).toBeDisabled();
  await expect.element(getByRole('button', { name: 'Previous article' })).toBeEnabled();
});

test('clicking previous and next navigates to the correct neighbor', async () => {
  // Arrange
  const { itemA, itemB, itemC } = setUpThreeItemRiver();
  const onNavigateToItem = vi.fn();

  // Act
  const { getByRole, getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem, onNavigateHome: vi.fn() });
  await expect.element(getByText('Middle item', { exact: true })).toBeInTheDocument();
  await getByRole('button', { name: 'Previous article' }).click();

  // Assert
  expect(onNavigateToItem).toHaveBeenCalledWith(itemA.id);

  // Act
  await getByRole('button', { name: 'Next article' }).click();

  // Assert
  expect(onNavigateToItem).toHaveBeenCalledWith(itemC.id);
});

test('shows the full extracted article body when the content is ready', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();
  itemBodyOverride = { description: descriptionsById.get(itemB.id) ?? '', article: { html: '<p>Full extracted body</p>', wordCount: 400 } };

  // Act
  const { getByTestId, getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByTestId('article-body').getByText('Full extracted body', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('2 min read')).toBeInTheDocument();
});

test('shows a loading hint while the article is being fetched', async () => {
  // Arrange: the raw description now arrives over the same call as the article, so there is
  // nothing to show synchronously ahead of it, unlike the fetched-article-only loading state before.
  const { itemB } = setUpThreeItemRiver();
  itemBodyOverride = 'pending';

  // Act
  const { getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByText('Loading full article…', { exact: true })).toBeInTheDocument();
});

test('shows the feed description and a note when the article is unavailable', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();
  itemBodyOverride = { description: descriptionsById.get(itemB.id) ?? '', article: undefined };

  // Act
  const { getByTestId, getByText } = await renderReader({ itemId: String(itemB.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByText('The full article could not be loaded. Read it at the source instead.', { exact: true })).toBeInTheDocument();
  await expect.element(getByTestId('article-body').getByText(`Item ${itemB.id} description`, { exact: true })).toBeInTheDocument();
});

test('shows a linkified description for a youtube item, with no unavailable message or duplicated standfirst', async () => {
  // Arrange
  const feed = createFeed({ title: 'Feed V', link: 'https://v.example/feed', type: 'youtube' });
  const item = createRow(feed, { description: 'Check this out: https://example.com/video\n\nMore info.' });
  allFeeds = [feed];
  allRows = [item];

  // Act
  const { getByTestId, getByText } = await renderReader({ itemId: String(item.id), onNavigateToItem: vi.fn(), onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByTestId('article-body').getByRole('link', { name: 'https://example.com/video' })).toBeInTheDocument();
  await expect.element(getByText('Check this out:', { exact: false })).toBeInTheDocument();
  await expect.element(getByText('The full article could not be loaded. Read it at the source instead.', { exact: true })).not.toBeInTheDocument();
});

test('the next article card targets the nearest unread item further down the list', async () => {
  // Arrange
  const { itemA, itemB, itemC } = setUpThreeItemRiver();
  itemB.readAt = '2024-01-02T00:00:00.000Z';
  const onNavigateToItem = vi.fn();

  // Act
  const { getByText } = await renderReader({ itemId: String(itemA.id), onNavigateToItem, onNavigateHome: vi.fn() });

  // Assert
  await expect.element(getByText('Next unread', { exact: true })).toBeInTheDocument();
  await getByText('Oldest item', { exact: true }).click();
  expect(onNavigateToItem).toHaveBeenCalledWith(itemC.id);
});

test('fetches and merges the nearest unread item past the loaded window', async () => {
  // Arrange: 60 items in one feed, page 1 only holds the newest 50 (publishedAt 60..11), all
  // read except the far older publishedAt 5, which sits well outside that window.
  const feed = createFeed({ title: 'Feed Big', link: 'https://big.example/feed' });
  allFeeds = [feed];
  let lastItemInWindow: RiverRow | undefined;
  let farUnreadItem: RiverRow | undefined;
  allRows = Array.from({ length: 60 }, (_, index) => {
    const publishedAt = index + 1;
    const row = createRow(feed, { title: `Item ${publishedAt}`, publishedAt, readAt: publishedAt === 5 ? undefined : '2024-01-01T00:00:00.000Z' });
    if (publishedAt === 11) {
      lastItemInWindow = row;
    }
    if (publishedAt === 5) {
      farUnreadItem = row;
    }
    return row;
  });
  if (!lastItemInWindow || !farUnreadItem) {
    throw new Error('expected both a window-edge row and a far unread row');
  }
  const onNavigateToItem = vi.fn();

  // Act: open the last item the initial page loads. Locally there is nothing after it, so
  // `navigation.nextUnread` starts undefined and Reader has to ask main for the next one.
  const { getByText } = await renderReader({ itemId: String(lastItemInWindow.id), onNavigateToItem, onNavigateHome: vi.fn() });
  await expect.element(getByText('Item 11', { exact: true })).toBeInTheDocument();

  // Assert: the fetched row merges into the cache and navigation finds it on the next render.
  await expect.element(getByText('Next unread', { exact: true })).toBeInTheDocument();
  await getByText('Item 5', { exact: true }).click();
  expect(onNavigateToItem).toHaveBeenCalledWith(farUnreadItem.id);
});
