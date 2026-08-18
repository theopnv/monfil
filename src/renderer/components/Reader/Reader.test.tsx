import { beforeEach, expect, test, vi } from 'vitest';
import type { Mock } from 'vitest';
import { render } from 'vitest-browser-react';
import { useFeeds, useReadState } from '@/providers/feeds-provider';
import Reader from './Reader';
import type { Feed } from '../../../preload/channels';

vi.mock(import('@/providers/feeds-provider'), async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    useFeeds: vi.fn(),
    useAddFeed: vi.fn(() => vi.fn()),
    useDeleteFeed: vi.fn(() => vi.fn()),
    useReadState: vi.fn(),
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
    pubDate: '2024-01-01',
    description: `<p>Item ${id} description</p>`,
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

// Ordered newest to oldest, matching toRiverItems' sort. itemA is spread
// across two feeds so navigation tests exercise the full flat river order.
function setUpThreeItemRiver() {
  const itemA = createFeedItem({ title: 'Newest item', pubDate: '2024-01-03' });
  const itemB = createFeedItem({ title: 'Middle item', pubDate: '2024-01-02' });
  const itemC = createFeedItem({ title: 'Oldest item', pubDate: '2024-01-01' });
  const feedA = createFeed({ title: 'Feed A', link: 'https://a.example/feed', items: [itemA] });
  const feedB = createFeed({ title: 'Feed B', link: 'https://b.example/feed', items: [itemB, itemC] });
  mockedUseFeeds.mockReturnValue([feedA, feedB]);
  return { itemA, itemB, itemC };
}

let markRead: Mock<(id: number) => void>;

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

  markRead = vi.fn<(id: number) => void>();
  mockedUseReadState.mockReturnValue({ isRead: () => false, markRead, toggleRead: vi.fn() });
});

test('renders the matched item title, byline and body', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();

  // Act
  const { getByText, getByTestId } = await render(<Reader itemId={String(itemB.id)} onNavigateToItem={vi.fn()} onNavigateHome={vi.fn()} />);

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
  const { getByText, getByRole } = await render(<Reader itemId="999999" onNavigateToItem={vi.fn()} onNavigateHome={onNavigateHome} />);

  // Assert
  await expect.element(getByText('This article could not be found.', { exact: true })).toBeInTheDocument();
  await getByRole('button', { name: 'Back to Home' }).click();
  expect(onNavigateHome).toHaveBeenCalled();
});

test('marks the current item read on mount', async () => {
  // Arrange
  const { itemB } = setUpThreeItemRiver();

  // Act
  await render(<Reader itemId={String(itemB.id)} onNavigateToItem={vi.fn()} onNavigateHome={vi.fn()} />);

  // Assert
  expect(markRead).toHaveBeenCalledWith(itemB.id);
});

test('previous is disabled on the newest item', async () => {
  // Arrange
  const { itemA } = setUpThreeItemRiver();

  // Act
  const { getByRole } = await render(<Reader itemId={String(itemA.id)} onNavigateToItem={vi.fn()} onNavigateHome={vi.fn()} />);

  // Assert
  await expect.element(getByRole('button', { name: 'Previous article' })).toBeDisabled();
  await expect.element(getByRole('button', { name: 'Next article' })).toBeEnabled();
});

test('next is disabled on the oldest item', async () => {
  // Arrange
  const { itemC } = setUpThreeItemRiver();

  // Act
  const { getByRole } = await render(<Reader itemId={String(itemC.id)} onNavigateToItem={vi.fn()} onNavigateHome={vi.fn()} />);

  // Assert
  await expect.element(getByRole('button', { name: 'Next article' })).toBeDisabled();
  await expect.element(getByRole('button', { name: 'Previous article' })).toBeEnabled();
});

test('clicking previous and next navigates to the correct neighbor', async () => {
  // Arrange
  const { itemA, itemB, itemC } = setUpThreeItemRiver();
  const onNavigateToItem = vi.fn();

  // Act
  const { getByRole } = await render(<Reader itemId={String(itemB.id)} onNavigateToItem={onNavigateToItem} onNavigateHome={vi.fn()} />);
  await getByRole('button', { name: 'Previous article' }).click();

  // Assert
  expect(onNavigateToItem).toHaveBeenCalledWith(itemA.id);

  // Act
  await getByRole('button', { name: 'Next article' }).click();

  // Assert
  expect(onNavigateToItem).toHaveBeenCalledWith(itemC.id);
});

test('the next article card targets the nearest unread item further down the list', async () => {
  // Arrange
  const { itemA, itemB, itemC } = setUpThreeItemRiver();
  mockedUseReadState.mockReturnValue({ isRead: (id) => id === itemB.id, markRead, toggleRead: vi.fn() });
  const onNavigateToItem = vi.fn();

  // Act
  const { getByText } = await render(<Reader itemId={String(itemA.id)} onNavigateToItem={onNavigateToItem} onNavigateHome={vi.fn()} />);

  // Assert
  await expect.element(getByText('Next unread', { exact: true })).toBeInTheDocument();
  await getByText('Oldest item', { exact: true }).click();
  expect(onNavigateToItem).toHaveBeenCalledWith(itemC.id);
});
