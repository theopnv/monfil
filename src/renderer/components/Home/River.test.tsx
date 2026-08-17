import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FeedsProvider, useFeeds } from '@/providers/feeds-provider';
import River from './River';
import type { Feed } from '../../../preload/channels';

vi.mock(import('@/providers/feeds-provider'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useFeeds: vi.fn(),
    useAddFeed: vi.fn(() => vi.fn()),
    useFeedsRefresh: vi.fn(() => ({ refreshNow: vi.fn(), isRefreshing: false })),
    useReadState: vi.fn(() => ({ isRead: () => false, markRead: vi.fn(), toggleRead: vi.fn() })),
  };
});

const mockedUseFeeds = vi.mocked(useFeeds);

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
    pubDate: '2024-01-01',
    description: `Item ${id} description`,
    image: undefined,
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
    showInHome: 1,
    category: { id: 1, name: 'Tech' },
    items: [],
    ...overrides,
  };
}

beforeEach(() => {
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
});

test('shows items from every feed by default', async () => {
  // Arrange
  const { getByText } = await render(<River onOpenItem={vi.fn()} />);

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).toBeInTheDocument();
});

test('selecting a feed only shows items from that feed', async () => {
  // Arrange
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <River onOpenItem={vi.fn()} />
    </FeedsProvider>
  );

  // Act
  await getByRole('button', { name: 'Tech' }).click();
  await getByRole('button', { name: /Feed A/ }).click();

  // Assert
  await expect.element(getByText('Item A1', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item A2', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item B1', { exact: true })).not.toBeInTheDocument();
});

test('hides feed items when showInHome is set to 0', async () => {
  // Arrange
  const feedC = createFeed({
    title: 'Feed C',
    link: 'https://c.example/feed',
    showInHome: 0,
    items: [createFeedItem({ title: 'Item C1', description: 'Item C1 description' })],
  });
  mockedUseFeeds.mockReturnValue((mockedUseFeeds() as Feed[]).concat(feedC));

  const { getByText } = await render(
    <FeedsProvider>
      <River onOpenItem={vi.fn()} />
    </FeedsProvider>
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
  const { getByText } = await render(<River onOpenItem={onOpenItem} />);

  // Act
  await getByText('Clickable item', { exact: true }).click();

  // Assert
  expect(onOpenItem).toHaveBeenCalledWith(item.id);
});
