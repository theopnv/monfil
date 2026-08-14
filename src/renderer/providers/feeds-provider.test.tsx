import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FeedsProvider, useAddFeed, useFeeds } from './feeds-provider';
import type { Feed } from '../../preload/channels';

let nextFeedId = 1;

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

function FeedsList() {
  const feeds = useFeeds();
  return (
    <ul>
      {feeds.map((feed) => (
        <li key={feed.link}>{feed.title}</li>
      ))}
    </ul>
  );
}

function AddFeedButton({ feed }: { feed: Feed }) {
  const addFeed = useAddFeed();
  return (
    <button type="button" onClick={() => addFeed(feed)}>
      Add {feed.title}
    </button>
  );
}

function ItemImages() {
  const feeds = useFeeds();
  return (
    <ul>
      {feeds.flatMap((feed) => feed.items.map((item) => (
        <li key={item.id}>{item.title}: {item.image ?? 'no-image'}</li>
      )))}
    </ul>
  );
}

let itemImageFetchedHandler: ((payload: { feedId: number; itemId: number; image: string }) => void) | undefined;

beforeEach(() => {
  itemImageFetchedHandler = undefined;
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn().mockResolvedValue([]),
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'feeds:item-image-fetched') {
          itemImageFetchedHandler = handler as typeof itemImageFetchedHandler;
        }
        return vi.fn();
      }),
      sendMessage: vi.fn(),
      once: vi.fn(),
    },
  } as unknown as typeof window.electron;
});

test('a feed added via useAddFeed appears to useFeeds consumers', async () => {
  // Arrange
  const feedA = createFeed({ title: 'Feed A' });
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <AddFeedButton feed={feedA} />
      <FeedsList />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Add Feed A' }).click();

  // Assert
  await expect.element(getByText('Feed A', { exact: true })).toBeInTheDocument();
});

test('re-adding the same link replaces the existing feed instead of duplicating it', async () => {
  // Arrange
  const originalFeed = createFeed({ link: 'https://example.com/shared', title: 'Original title' });
  const updatedFeed = createFeed({ link: 'https://example.com/shared', title: 'Updated title' });
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <AddFeedButton feed={originalFeed} />
      <AddFeedButton feed={updatedFeed} />
      <FeedsList />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Add Original title' }).click();
  await getByRole('button', { name: 'Add Updated title' }).click();

  // Assert
  await expect.element(getByText('Updated title', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Original title', { exact: true })).not.toBeInTheDocument();
});

test('an item-image-fetched push merges the image into the matching feed item, leaving others untouched', async () => {
  // Arrange
  const targetItem = { id: 1, feed_id: 1, title: 'Target item', link: 'https://example.com/target', pubDate: '2024-01-01', description: '', image: undefined };
  const otherItemInSameFeed = { id: 2, feed_id: 1, title: 'Other item', link: 'https://example.com/other', pubDate: '2024-01-01', description: '', image: undefined };
  const itemInOtherFeed = { id: 3, feed_id: 2, title: 'Item in other feed', link: 'https://example.com/other-feed-item', pubDate: '2024-01-01', description: '', image: undefined };
  const targetFeed = createFeed({ title: 'Target feed', items: [targetItem, otherItemInSameFeed] });
  const otherFeed = createFeed({ title: 'Other feed', items: [itemInOtherFeed] });
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <AddFeedButton feed={targetFeed} />
      <AddFeedButton feed={otherFeed} />
      <ItemImages />
    </FeedsProvider>,
  );
  await getByRole('button', { name: 'Add Target feed' }).click();
  await getByRole('button', { name: 'Add Other feed' }).click();
  await expect.element(getByText('Target item: no-image', { exact: true })).toBeInTheDocument();

  // Act
  itemImageFetchedHandler?.({ feedId: targetFeed.id, itemId: targetItem.id, image: 'https://example.com/fetched.jpg' });

  // Assert
  await expect.element(getByText('Target item: https://example.com/fetched.jpg', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Other item: no-image', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Item in other feed: no-image', { exact: true })).toBeInTheDocument();
});
