import { beforeEach, expect, test, vi } from 'vitest';
import { render } from 'vitest-browser-react';
import { FeedsProvider, useAddFeed, useDeleteFeed, useFeeds, useFeedsRefresh, useReadState } from './feeds-provider';
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

function DeleteFeedButton({ feedId }: { feedId: number }) {
  const deleteFeed = useDeleteFeed();
  return (
    <button type="button" onClick={() => { void deleteFeed(feedId); }}>
      Delete {feedId}
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

function RefreshButton() {
  const { refreshNow, isRefreshing } = useFeedsRefresh();
  return (
    <button type="button" onClick={refreshNow}>
      {isRefreshing ? 'Refreshing' : 'Refresh'}
    </button>
  );
}

function ReadStateProbe({ id }: { id: number }) {
  const { isRead, markRead, toggleRead } = useReadState();
  return (
    <div>
      <span>Item {id} is {isRead(id) ? 'read' : 'unread'}</span>
      <button type="button" onClick={() => markRead(id)}>Mark {id} read</button>
      <button type="button" onClick={() => toggleRead(id)}>Toggle {id}</button>
    </div>
  );
}

let itemImageFetchedHandler: ((payload: { feedId: number; itemId: number; image: string }) => void) | undefined;
let feedsListPushHandler: ((payload: Feed[]) => void) | undefined;
let invokeImpl: (channel: string) => Promise<unknown>;

beforeEach(() => {
  itemImageFetchedHandler = undefined;
  feedsListPushHandler = undefined;
  invokeImpl = () => Promise.resolve([]);
  window.electron = {
    ipcRenderer: {
      invoke: vi.fn((channel: string) => invokeImpl(channel)),
      on: vi.fn((channel: string, handler: (payload: never) => void) => {
        if (channel === 'feeds:item-image-fetched') {
          itemImageFetchedHandler = handler as typeof itemImageFetchedHandler;
        }
        if (channel === 'feeds:list') {
          feedsListPushHandler = handler as typeof feedsListPushHandler;
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

test('a feeds:list push replaces the list', async () => {
  // Arrange
  const pushedFeed = createFeed({ title: 'Pushed feed' });
  const { getByText } = await render(
    <FeedsProvider>
      <FeedsList />
    </FeedsProvider>,
  );

  // Act
  feedsListPushHandler?.([pushedFeed]);

  // Assert
  await expect.element(getByText('Pushed feed', { exact: true })).toBeInTheDocument();
});

test('a feeds:list invoke response that lands after a push does not overwrite it', async () => {
  // Arrange
  const pushedFeed = createFeed({ title: 'Pushed feed' });
  const staleFeed = createFeed({ title: 'Stale feed' });
  let answerTheInvoke!: (feeds: Feed[]) => void;
  const pendingList = new Promise<Feed[]>((resolve) => {
    answerTheInvoke = resolve;
  });
  invokeImpl = (channel) => (channel === 'feeds:list' ? pendingList : Promise.resolve([]));
  const { getByText } = await render(
    <FeedsProvider>
      <FeedsList />
    </FeedsProvider>,
  );
  feedsListPushHandler?.([pushedFeed]);
  await expect.element(getByText('Pushed feed', { exact: true })).toBeInTheDocument();

  // Act
  answerTheInvoke([staleFeed]);
  await pendingList;
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Assert
  await expect.element(getByText('Pushed feed', { exact: true })).toBeInTheDocument();
  await expect.element(getByText('Stale feed', { exact: true })).not.toBeInTheDocument();
});

test('useDeleteFeed replaces the list from the reply', async () => {
  // Arrange
  const feedA = createFeed({ title: 'Feed A' });
  const feedC = createFeed({ title: 'Feed C' });
  invokeImpl = (channel) => Promise.resolve(channel === 'feeds:delete-feed' ? { success: true, data: [feedC] } : []);
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <DeleteFeedButton feedId={feedA.id} />
      <FeedsList />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: `Delete ${feedA.id}` }).click();

  // Assert
  await expect.element(getByText('Feed C', { exact: true })).toBeInTheDocument();
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('feeds:delete-feed', feedA.id);
});

test('a stale feeds:list invoke does not restore a feed removed by useDeleteFeed', async () => {
  // Arrange
  const feedA = createFeed({ title: 'Feed A' });
  let answerTheInvoke!: (feeds: Feed[]) => void;
  const pendingList = new Promise<Feed[]>((resolve) => {
    answerTheInvoke = resolve;
  });
  invokeImpl = (channel) => {
    if (channel === 'feeds:list') return pendingList;
    if (channel === 'feeds:delete-feed') return Promise.resolve({ success: true, data: [] });
    return Promise.resolve([]);
  };
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <DeleteFeedButton feedId={feedA.id} />
      <FeedsList />
    </FeedsProvider>,
  );
  await getByRole('button', { name: `Delete ${feedA.id}` }).click();
  await expect.element(getByText('Feed A', { exact: true })).not.toBeInTheDocument();

  // Act
  answerTheInvoke([feedA]);
  await pendingList;
  await new Promise((resolve) => setTimeout(resolve, 0));

  // Assert
  await expect.element(getByText('Feed A', { exact: true })).not.toBeInTheDocument();
});

test('refreshNow asks main for a refresh and shows the list it answers with', async () => {
  // Arrange
  const refreshedFeed = createFeed({ title: 'Refreshed feed' });
  invokeImpl = (channel) => Promise.resolve(channel === 'feeds:refresh' ? [refreshedFeed] : []);
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <RefreshButton />
      <FeedsList />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Refresh' }).click();

  // Assert
  await expect.element(getByText('Refreshed feed', { exact: true })).toBeInTheDocument();
  expect(window.electron.ipcRenderer.invoke).toHaveBeenCalledWith('feeds:refresh', undefined);
});

test('refreshNow stops reporting a refresh once it fails', async () => {
  // Arrange
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  invokeImpl = (channel) => (channel === 'feeds:refresh' ? Promise.reject(new Error('offline')) : Promise.resolve([]));
  const { getByRole } = await render(
    <FeedsProvider>
      <RefreshButton />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Refresh' }).click();

  // Assert
  await vi.waitFor(() => { expect(consoleError).toHaveBeenCalled(); });
  await expect.element(getByRole('button', { name: 'Refresh' })).toBeInTheDocument();
});

test('a fresh provider starts with nothing read', async () => {
  // Arrange
  const { getByText } = await render(
    <FeedsProvider>
      <ReadStateProbe id={1} />
    </FeedsProvider>,
  );

  // Assert
  await expect.element(getByText('Item 1 is unread', { exact: true })).toBeInTheDocument();
});

test('markRead marks an item read', async () => {
  // Arrange
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <ReadStateProbe id={1} />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Mark 1 read' }).click();

  // Assert
  await expect.element(getByText('Item 1 is read', { exact: true })).toBeInTheDocument();
});

test('marking an already-read item again is a no-op', async () => {
  // Arrange
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <ReadStateProbe id={1} />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Mark 1 read' }).click();
  await getByRole('button', { name: 'Mark 1 read' }).click();

  // Assert
  await expect.element(getByText('Item 1 is read', { exact: true })).toBeInTheDocument();
});

test('toggleRead flips the read state both ways', async () => {
  // Arrange
  const { getByText, getByRole } = await render(
    <FeedsProvider>
      <ReadStateProbe id={1} />
    </FeedsProvider>,
  );

  // Act
  await getByRole('button', { name: 'Toggle 1' }).click();

  // Assert
  await expect.element(getByText('Item 1 is read', { exact: true })).toBeInTheDocument();

  // Act
  await getByRole('button', { name: 'Toggle 1' }).click();

  // Assert
  await expect.element(getByText('Item 1 is unread', { exact: true })).toBeInTheDocument();
});
