import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FeedsProvider, useFeeds, useReadState } from '@/providers/feeds-provider';
import { PreferencesProvider } from '@/providers/preferences-provider';
import River from './River';
import type { Feed } from '../../../preload/channels';

vi.mock(import('@/providers/feeds-provider'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useFeeds: vi.fn(),
    useAddFeed: vi.fn(() => vi.fn()),
    useDeleteFeed: vi.fn(() => vi.fn()),
    useSetShowInHome: vi.fn(() => vi.fn()),
    useFeedsRefresh: vi.fn(() => ({ refreshNow: vi.fn(), isRefreshing: false })),
    useReadState: vi.fn(() => ({ isRead: () => false, markRead: vi.fn(), toggleRead: vi.fn(), markAllRead: vi.fn() })),
  };
});

const mockedUseFeeds = vi.mocked(useFeeds);
const mockedUseReadState = vi.mocked(useReadState);

type FeedItem = Feed['items'][number];

let nextFeedId = 1;
let nextItemId = 1;

function createFeedItem(overrides: Partial<FeedItem> = {}): FeedItem {
  const id = nextItemId++;
  return {
    id,
    feed_id: 1,
    title: `Item ${id}`,
    link: `https://example.com/item-${id}`,
    guid: `https://example.com/item-${id}`,
    pubDate: '2024-01-01',
    description: `Item ${id} description`,
    image: undefined,
    author: undefined,
    extra: undefined,
    read_at: undefined,
    ...overrides,
  };
}

function createFeed(overrides: Partial<Feed> = {}): Feed {
  const id = nextFeedId++;
  return {
    id,
    link: `https://example.com/feed-${id}`,
    title: `Feed ${id}`,
    category_id: 1,
    type: 'rss',
    showInHome: 1,
    last_fetched_at: undefined,
    last_error: undefined,
    category: { id: 1, name: 'Tech' },
    items: [],
    ...overrides,
  };
}

beforeEach(() => {
  localStorage.clear();
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn().mockResolvedValue([]),
      on: vi.fn(() => vi.fn()),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;

  const feedA = createFeed({
    title: 'Feed A',
    link: 'https://a.example/feed',
    items: [
      createFeedItem({ title: 'Item A1', description: 'Item A1 description' }),
      createFeedItem({ title: 'Item A2', description: 'Item A2 description' }),
    ],
  });
  const feedB = createFeed({
    title: 'Feed B',
    link: 'https://b.example/feed',
    items: [createFeedItem({ title: 'Item B1', description: 'Item B1 description' })],
  });

  mockedUseFeeds.mockReturnValue([feedA, feedB]);
  mockedUseReadState.mockReturnValue({ isRead: () => false, markRead: vi.fn(), toggleRead: vi.fn(), markAllRead: vi.fn() });
});

test('shows items from every feed by default', async () => {
  // Arrange
  const { getByText } = await render(<PreferencesProvider><River onOpenItem={vi.fn()} /></PreferencesProvider>);

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
});

test('rotating feed visibility narrows, widens, then narrows home again', async () => {
  // Arrange
  const { getByText, getByRole } = await render(
    <PreferencesProvider>
      <FeedsProvider>
        <River onOpenItem={vi.fn()} />
      </FeedsProvider>
    </PreferencesProvider>
  );
  await getByRole('button', { name: 'Tech', exact: true }).click();

  // Act: one click on Feed A shows only Feed A.
  await getByRole('button', { name: /Feed A/ }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).not.toBeInTheDocument();

  // Act: focusing Feed B too shows both.
  await getByRole('button', { name: /Feed B/ }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();

  // Act: clicking Feed A again drops it from the only set, leaving Feed B alone.
  await getByRole('button', { name: /Feed A/ }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).not.toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
});

test('hides feed items when showInHome is set to 0', async () => {
  // Arrange
  const feedC = createFeed({
    title: 'Feed C',
    link: 'https://c.example/feed',
    type: 'rss',
    showInHome: 0,
    last_fetched_at: undefined,
    last_error: undefined,
    items: [createFeedItem({ title: 'Item C1', description: 'Item C1 description' })],
  });
  mockedUseFeeds.mockReturnValue((mockedUseFeeds() as Feed[]).concat(feedC));

  const { getByText } = await render(
    <PreferencesProvider>
      <FeedsProvider>
        <River onOpenItem={vi.fn()} />
      </FeedsProvider>
    </PreferencesProvider>
  );

  // Assert
  await expect.element(getByText('Item C1', { exact: true })).not.toBeInTheDocument();
});

test('clicking a card invokes onOpenItem with the item id', async () => {
  // Arrange
  const item = createFeedItem({ title: 'Clickable item' });
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed', items: [item] });
  mockedUseFeeds.mockReturnValue([feed]);
  const onOpenItem = vi.fn();
  const { getByText } = await render(<PreferencesProvider><River onOpenItem={onOpenItem} /></PreferencesProvider>);

  // Act
  await getByText('Clickable item', { exact: true }).click();

  // Assert
  expect(onOpenItem).toHaveBeenCalledWith(item.id);
});

test('hides read items when the hideReadItems preference is on', async () => {
  // Arrange
  localStorage.setItem('preferences-hide-read-items', JSON.stringify(true));
  const readItem = createFeedItem({ title: 'Read item' });
  const unreadItem = createFeedItem({ title: 'Unread item' });
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed', items: [readItem, unreadItem] });
  mockedUseFeeds.mockReturnValue([feed]);
  mockedUseReadState.mockReturnValue({ isRead: (id) => id === readItem.id, markRead: vi.fn(), toggleRead: vi.fn(), markAllRead: vi.fn() });

  // Act
  const { getByText } = await render(<PreferencesProvider><River onOpenItem={vi.fn()} /></PreferencesProvider>);

  // Assert
  await expect.element(getByText('Unread item', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Read item', { exact: true })).not.toBeInTheDocument();
});

test('opening a link externally sends link:open, marks it read, and does not navigate', async () => {
  // Arrange
  localStorage.setItem('preferences-open-links-externally', JSON.stringify(true));
  const item = createFeedItem({ title: 'External item', link: 'https://x.example/article' });
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed', items: [item] });
  mockedUseFeeds.mockReturnValue([feed]);
  const markRead = vi.fn();
  mockedUseReadState.mockReturnValue({ isRead: () => false, markRead, toggleRead: vi.fn(), markAllRead: vi.fn() });
  const onOpenItem = vi.fn();
  const { getByText } = await render(<PreferencesProvider><River onOpenItem={onOpenItem} /></PreferencesProvider>);

  // Act
  await getByText('External item', { exact: true }).click();

  // Assert
  expect(window.electron.ipcRenderer.sendMessage).toHaveBeenCalledWith('link:open', item.link);
  expect(markRead).toHaveBeenCalledWith(item.id);
  expect(onOpenItem).not.toHaveBeenCalled();
});

test('density reads from preferences', async () => {
  // Arrange
  localStorage.setItem('preferences-density', JSON.stringify('Compact'));
  const item = createFeedItem({ title: 'Compact item' });
  const feed = createFeed({ title: 'Feed X', link: 'https://x.example/feed', items: [item] });
  mockedUseFeeds.mockReturnValue([feed]);

  // Act
  const { getByText } = await render(<PreferencesProvider><River onOpenItem={vi.fn()} /></PreferencesProvider>);

  // Assert
  const cardRoot = getByText('Compact item', { exact: true }).element().closest('[data-item-id]');
  expect(cardRoot?.tagName).toBe('DIV');
});
